import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { auditLogger } from '../middleware/auditLogger';
import PDFDocument from 'pdfkit';
import { createObjectCsvStringifier } from 'csv-writer';

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

const ensurePatientInOrganization = async (patientId: string, organizationId: string) => {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, organizationId },
  });

  if (!patient) {
    throw new AppError('Patient not found', 404);
  }

  return patient;
};

/**
 * ==========================================
 * 1. SISTEMA DE CONSENTIMENTO
 * ==========================================
 */

// Criar novo consentimento
export const createConsent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId, type, granted, privacyVersion } = req.body;
    const organizationId = getOrganizationId(req);

    await ensurePatientInOrganization(patientId, organizationId);

    const consent = await prisma.consent.create({
      data: {
        patientId,
        type,
        granted,
        privacyVersion,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        grantedAt: new Date(),
      },
    });

    logger.info(`Consent created for patient ${patientId}: ${type} = ${granted}`);

    res.status(201).json({
      success: true,
      consent,
    });
  } catch (error) {
    next(error);
  }
};

// Revogar consentimento
export const revokeConsent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const organizationId = getOrganizationId(req);

    const consentInOrg = await prisma.consent.findFirst({
      where: {
        id,
        patient: { organizationId },
      },
      select: { id: true },
    });

    if (!consentInOrg) {
      throw new AppError('Consent not found', 404);
    }

    const consent = await prisma.consent.update({
      where: { id },
      data: {
        granted: false,
        revokedAt: new Date(),
      },
    });

    logger.info(`Consent revoked: ${id}`);

    res.json({
      success: true,
      consent,
    });
  } catch (error) {
    next(error);
  }
};

// Listar consentimentos do paciente
export const getPatientConsents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId } = req.params;
    const organizationId = getOrganizationId(req);

    const consents = await prisma.consent.findMany({
      where: {
        patientId,
        patient: { organizationId },
      },
      orderBy: { grantedAt: 'desc' },
    });

    res.json({
      success: true,
      consents,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * 2. DIREITO AO ESQUECIMENTO (ANONIMIZAÇÃO)
 * ==========================================
 */

// Função para anonimizar dados
function anonymizeData(patient: any) {
  const hash = (str: string) => {
    // Criar hash simples para pseudonimização
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `ANON_${Math.abs(hash).toString(16).substring(0, 8).toUpperCase()}`;
  };

  return {
    name: hash(patient.name),
    phone: hash(patient.phone),
    email: null,
    responsible: null,
    allergies: '[REMOVIDO]',
    observations: '[REMOVIDO]',
    isAnonymized: true,
    anonymizedAt: new Date(),
  };
}

// Anonimizar paciente (Direito ao Esquecimento)
export const anonymizePatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId } = req.params;
    const { reason } = req.body;
    const organizationId = getOrganizationId(req);

    // Buscar paciente
    const patient = await ensurePatientInOrganization(patientId, organizationId);

    if (patient.isAnonymized) {
      throw new AppError('Patient already anonymized', 400);
    }

    // Verificar se há dados que precisam ser preservados
    const hasActiveTreatments = await prisma.appointment.count({
      where: {
        patientId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
    });

    if (hasActiveTreatments > 0) {
      throw new AppError(
        'Cannot anonymize patient with active treatments. Complete or cancel appointments first.',
        400
      );
    }

    // Anonimizar dados do paciente
    const anonymizedData = anonymizeData(patient);

    await prisma.patient.update({
      where: { id: patientId },
      data: anonymizedData,
    });

    // Anonimizar mensagens relacionadas
    await prisma.message.updateMany({
      where: {
        chat: {
          patientId,
        },
      },
      data: {
        content: '[CONTEÚDO ANONIMIZADO]',
        mediaUrl: null,
        fileName: null,
      },
    });

    // Criar registro de exclusão
    const deletionRecord = await prisma.dataDeletionLog.create({
      data: {
        patientId,
        originalName: patient.name,
        originalPhone: patient.phone,
        anonymizedAt: new Date(),
        reason: reason || 'Patient request',
        requestedBy: req.user?.id || 'system',
        ipAddress: req.ip || 'unknown',
        certificateId: `DEL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    });

    // Log de auditoria
    logger.info({
      type: 'GDPR_DELETION',
      patientId,
      certificateId: deletionRecord.certificateId,
      requestedBy: req.user?.id,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Patient data anonymized successfully',
      certificateId: deletionRecord.certificateId,
      anonymizedAt: deletionRecord.anonymizedAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * 3. EXPORTAÇÃO DE DADOS (PORTABILIDADE)
 * ==========================================
 */

// Exportar dados do paciente (JSON)
export const exportPatientDataJSON = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId } = req.params;
    const organizationId = getOrganizationId(req);

    await ensurePatientInOrganization(patientId, organizationId);

    // Buscar todos os dados do paciente
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId },
      include: {
        therapies: true,
        appointments: true,
        records: true,
        chats: {
          include: {
            messages: true,
          },
        },
      },
    });

    // Registrar exportação
    await prisma.dataExportLog.create({
      data: {
        patientId,
        format: 'JSON',
        exportedBy: req.user?.id || 'system',
        exportedAt: new Date(),
        ipAddress: req.ip || 'unknown',
      },
    });

    res.json({
      success: true,
      data: patient,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

// Exportar dados do paciente (PDF)
export const exportPatientDataPDF = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId } = req.params;
    const organizationId = getOrganizationId(req);

    await ensurePatientInOrganization(patientId, organizationId);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId },
      include: {
        therapies: true,
        appointments: true,
        records: true,
      },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    // Criar PDF
    const doc = new PDFDocument();
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      
      // Registrar exportação
      prisma.dataExportLog.create({
        data: {
          patientId,
          format: 'PDF',
          exportedBy: req.user?.id || 'system',
          exportedAt: new Date(),
          ipAddress: req.ip || 'unknown',
        },
      }).catch(console.error);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="dados-${patientId}.pdf"`);
      res.send(pdfBuffer);
    });

    // Conteúdo do PDF
    doc.fontSize(20).text('Relatório de Dados Pessoais', 50, 50);
    doc.fontSize(12).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 50, 80);
    doc.moveDown();

    doc.fontSize(14).text('Informações do Paciente', 50, 120);
    doc.fontSize(10)
      .text(`Nome: ${patient.name}`, 50, 140)
      .text(`Idade: ${patient.age || 'N/A'}`, 50, 155)
      .text(`Telefone: ${patient.phone}`, 50, 170)
      .text(`Email: ${patient.email || 'N/A'}`, 50, 185);

    doc.moveDown();
    doc.fontSize(14).text('Terapias', 50, 220);
    patient.therapies.forEach((therapy: any, i: number) => {
      doc.fontSize(10).text(`- ${therapy.name}`, 50, 240 + (i * 15));
    });

    doc.moveDown();
    doc.fontSize(14).text('Agendamentos', 50, 300);
    patient.appointments.forEach((apt: any, i: number) => {
      doc.fontSize(10).text(
        `- ${apt.therapy}: ${new Date(apt.date).toLocaleDateString('pt-BR')} (${apt.status})`,
        50,
        320 + (i * 15)
      );
    });

    doc.moveDown();
    doc.fontSize(14).text('Prontuários', 50, 400);
    patient.records.forEach((record: any, i: number) => {
      doc.fontSize(10)
        .text(`- Data: ${new Date(record.date).toLocaleDateString('pt-BR')}`, 50, 420 + (i * 30))
        .text(`  Profissional: ${record.professional}`, 50, 435 + (i * 30));
    });

    doc.fontSize(8)
      .text('Este documento foi gerado em conformidade com a LGPD.', 50, 700)
      .text('Para mais informações, entre em contato com o DPO.', 50, 715);

    doc.end();
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * 4. LOGS DE ACESSO (ROPA)
 * ==========================================
 */

// Registrar acesso a dados
export const logDataAccess = async (
  userId: string,
  patientId: string | null,
  resource: string,
  resourceId: string,
  action: string,
  ip: string,
  userAgent: string,
  reason?: string
) => {
  try {
    await prisma.dataAccessLog.create({
      data: {
        userId,
        patientId,
        resource,
        resourceId,
        action,
        ipAddress: ip,
        userAgent,
        reason,
      },
    });
  } catch (error) {
    logger.error('Error logging data access:', error);
  }
};

// Obter logs de acesso do paciente
export const getPatientAccessLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId } = req.params;
    const { startDate, endDate, page = '1', limit = '50' } = req.query;
    const organizationId = getOrganizationId(req);

    const where: any = {
      patientId,
      patient: { organizationId },
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.dataAccessLog.findMany({
        where,
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.dataAccessLog.count({ where }),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Obter relatório de processamento (ROPA)
export const getProcessingReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId } = req.params;
    const organizationId = getOrganizationId(req);

    const patient = await prisma.patient.findFirst({
      where: { id: patientId, organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    // Contagens
    const [
      totalAccesses,
      uniqueUsers,
      totalExports,
      totalMessages,
      totalAppointments,
      consents,
    ] = await Promise.all([
      prisma.dataAccessLog.count({ where: { patientId } }),
      prisma.dataAccessLog.groupBy({
        by: ['userId'],
        where: { patientId },
      }),
      prisma.dataExportLog.count({ where: { patientId } }),
      prisma.message.count({
        where: { chat: { patientId } },
      }),
      prisma.appointment.count({ where: { patientId } }),
      prisma.consent.findMany({ where: { patientId } }),
    ]);

    // Últimos acessos
    const recentAccesses = await prisma.dataAccessLog.findMany({
      where: { patientId },
      include: {
        user: {
          select: { name: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    res.json({
      success: true,
      report: {
        patient: {
          ...patient,
          createdAt: patient.createdAt.toISOString(),
          updatedAt: patient.updatedAt.toISOString(),
        },
        processingSummary: {
          totalAccesses,
          uniqueUsersAccessed: uniqueUsers.length,
          totalExports,
          totalMessages,
          totalAppointments,
          dataRetention: '5 anos (conforme LGPD)',
        },
        consents: consents.map((c) => ({
          type: c.type,
          granted: c.granted,
          grantedAt: c.grantedAt?.toISOString(),
          revokedAt: c.revokedAt?.toISOString(),
        })),
        recentAccesses: recentAccesses.map((a) => ({
          user: a.user?.name || 'System',
          action: a.action,
          resource: a.resource,
          timestamp: a.timestamp.toISOString(),
          reason: a.reason,
        })),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * 5. CERTIFICADOS E RELATÓRIOS
 * ==========================================
 */

// Gerar certificado de exclusão
export const generateDeletionCertificate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { certificateId } = req.params;
    const organizationId = getOrganizationId(req);

    const deletionLog = await prisma.dataDeletionLog.findFirst({
      where: {
        certificateId,
        patient: { organizationId },
      },
    });

    if (!deletionLog) {
      throw new AppError('Certificate not found', 404);
    }

    res.json({
      success: true,
      certificate: {
        id: deletionLog.certificateId,
        originalName: deletionLog.originalName,
        anonymizedAt: deletionLog.anonymizedAt.toISOString(),
        reason: deletionLog.reason,
        requestedBy: deletionLog.requestedBy,
        ipAddress: deletionLog.ipAddress,
        message: 'Os dados pessoais foram anonimizados conforme solicitação.',
        legalBasis: 'Art. 18, inciso VI da LGPD - Direito ao esquecimento',
      },
    });
  } catch (error) {
    next(error);
  }
};

// Listar todas as exclusões
export const getDeletionLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const organizationId = getOrganizationId(req);
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [logs, total] = await Promise.all([
      prisma.dataDeletionLog.findMany({
        where: {
          patient: { organizationId },
        },
        orderBy: { anonymizedAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.dataDeletionLog.count({
        where: {
          patient: { organizationId },
        },
      }),
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * 6. SOLICITAÇÕES LGPD (TICKETS / PROTOCOLO)
 * ==========================================
 */

// Gerar número de protocolo único
function generateProtocol(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `LGPD-${date}-${random}`;
}

// Abrir solicitação LGPD
export const createLGPDRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId, type, notes } = req.body;
    const organizationId = getOrganizationId(req);

    const VALID_TYPES = ['EXPORT', 'DELETION', 'CORRECTION', 'ACCESS', 'PORTABILITY', 'REVOCATION'];
    if (!VALID_TYPES.includes(type)) {
      throw new AppError(`Tipo inválido. Valores aceitos: ${VALID_TYPES.join(', ')}`, 400);
    }

    if (patientId) {
      await ensurePatientInOrganization(patientId, organizationId);
    }

    const request = await prisma.lGPDRequest.create({
      data: {
        organizationId,
        patientId: patientId || null,
        type,
        notes,
        protocol: generateProtocol(),
        ipAddress: req.ip || 'unknown',
      },
    });

    logger.info({
      type: 'LGPD_REQUEST_CREATED',
      protocol: request.protocol,
      requestType: type,
      patientId,
      organizationId,
      requestedBy: req.user?.id,
    });

    res.status(201).json({
      success: true,
      request,
      message: `Solicitação registrada com protocolo ${request.protocol}`,
    });
  } catch (error) {
    next(error);
  }
};

// Listar solicitações LGPD da organização
export const listLGPDRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { status, type, page = '1', limit = '20' } = req.query;
    const organizationId = getOrganizationId(req);

    const where: any = { organizationId };
    if (status) where.status = status;
    if (type) where.type = type;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [requests, total] = await Promise.all([
      prisma.lGPDRequest.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true } },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
      prisma.lGPDRequest.count({ where }),
    ]);

    res.json({
      success: true,
      requests,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Atualizar status da solicitação (admin)
export const updateLGPDRequestStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const organizationId = getOrganizationId(req);

    const VALID_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError(`Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}`, 400);
    }

    const existing = await prisma.lGPDRequest.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    const request = await prisma.lGPDRequest.update({
      where: { id },
      data: {
        status,
        notes: notes ?? existing.notes,
        respondedBy: req.user?.id,
        completedAt: status === 'COMPLETED' ? new Date() : existing.completedAt,
      },
    });

    logger.info({
      type: 'LGPD_REQUEST_UPDATED',
      protocol: request.protocol,
      newStatus: status,
      respondedBy: req.user?.id,
    });

    res.json({ success: true, request });
  } catch (error) {
    next(error);
  }
};

/**
 * ==========================================
 * 7. RELATÓRIO DE AUDITORIA EXPORTÁVEL
 * ==========================================
 */

// Exportar trilha de auditoria da organização por período (CSV)
export const exportOrgAuditReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;
    const organizationId = getOrganizationId(req);

    const where: any = {
      user: {
        memberships: {
          some: { organizationId, isActive: true },
        },
      },
    };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const logs = await prisma.dataAccessLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        patient: { select: { id: true, name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'timestamp', title: 'Data/Hora' },
        { id: 'userId', title: 'ID Usuário' },
        { id: 'userName', title: 'Nome Usuário' },
        { id: 'userEmail', title: 'Email Usuário' },
        { id: 'patientId', title: 'ID Paciente' },
        { id: 'patientName', title: 'Nome Paciente' },
        { id: 'resource', title: 'Recurso' },
        { id: 'action', title: 'Ação' },
        { id: 'ipAddress', title: 'IP' },
        { id: 'reason', title: 'Motivo' },
      ],
    });

    const records = logs.map((log) => ({
      timestamp: log.timestamp.toISOString(),
      userId: log.userId,
      userName: log.user?.name || '',
      userEmail: log.user?.email || '',
      patientId: log.patientId || '',
      patientName: log.patient?.name || '',
      resource: log.resource,
      action: log.action,
      ipAddress: log.ipAddress,
      reason: log.reason || '',
    }));

    const csv = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
    const filename = `auditoria-${organizationId}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM para Excel abrir corretamente
  } catch (error) {
    next(error);
  }
};

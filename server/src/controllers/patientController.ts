import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { logDataAccess } from './gdprController';

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

export const getPatients = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { search, therapy } = req.query;
    const organizationId = getOrganizationId(req);

    const where: any = { isActive: true, organizationId };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string } },
        { email: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (therapy) {
      where.therapies = {
        some: { id: therapy as string },
      };
    }

    const patients = await prisma.patient.findMany({
      where,
      include: {
        therapies: true,
        _count: {
          select: { appointments: true, chats: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      patients,
    });
  } catch (error) {
    next(error);
  }
};

export const getPatientById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const patient = await prisma.patient.findFirst({
      where: { id, organizationId },
      include: {
        therapies: true,
        appointments: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        records: {
          orderBy: { date: 'desc' },
          take: 5,
        },
        chats: {
          include: {
            _count: {
              select: { messages: true },
            },
          },
        },
      },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    // 🔒 2.2 Auditoria — registrar acesso a dados clínicos
    logDataAccess(
      req.user!.id,
      patient.id,
      'patient',
      patient.id,
      'VIEW',
      req.ip || 'unknown',
      req.headers['user-agent'] || ''
    );

    res.json({
      success: true,
      patient,
    });
  } catch (error) {
    next(error);
  }
};

export const createPatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const {
      name,
      age,
      phone,
      email,
      responsible,
      therapyIds,
      allergies,
      observations,
    } = req.body;

    const patient = await prisma.patient.create({
      data: {
        organizationId,
        name,
        age,
        phone,
        email,
        responsible,
        allergies,
        observations,
        therapies: therapyIds
          ? { connect: therapyIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: {
        therapies: true,
      },
    });

    logger.info(`Patient created: ${patient.name}`);

    res.status(201).json({
      success: true,
      patient,
    });
  } catch (error) {
    next(error);
  }
};

export const updatePatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const {
      name,
      age,
      phone,
      email,
      responsible,
      therapyIds,
      allergies,
      observations,
      isActive,
    } = req.body;

    const existing = await prisma.patient.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Patient not found', 404);
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        name,
        age,
        phone,
        email,
        responsible,
        allergies,
        observations,
        isActive,
        therapies: therapyIds
          ? { set: therapyIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: {
        therapies: true,
      },
    });

    logger.info(`Patient updated: ${patient.name}`);

    res.json({
      success: true,
      patient,
    });
  } catch (error) {
    next(error);
  }
};

export const deletePatient = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const existing = await prisma.patient.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!existing) {
      throw new AppError('Patient not found', 404);
    }

    await prisma.patient.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info(`Patient soft deleted: ${id}`);

    res.json({
      success: true,
      message: 'Patient deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const createAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { date, therapy, notes } = req.body;

    const patient = await prisma.patient.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: id,
        date: new Date(date),
        therapy,
        notes,
      },
    });

    logger.info(`Appointment created for patient ${id}`);

    res.status(201).json({
      success: true,
      appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const confirmAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { appointmentId } = req.params;
    const organizationId = getOrganizationId(req);

    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        patient: { organizationId },
      },
      select: { id: true },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CONFIRMED' },
    });

    res.json({
      success: true,
      appointment: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

export const getMedicalRecords = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const patient = await prisma.patient.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    const records = await prisma.medicalRecord.findMany({
      where: { patientId: id },
      orderBy: { date: 'desc' },
    });

    res.json({
      success: true,
      records,
    });
  } catch (error) {
    next(error);
  }
};

export const createMedicalRecord = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { content, type, professional } = req.body;

    const patient = await prisma.patient.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!patient) {
      throw new AppError('Patient not found', 404);
    }

    const record = await prisma.medicalRecord.create({
      data: {
        patientId: id,
        content,
        type,
        professional,
      },
    });

    logger.info(`Medical record created for patient ${id}`);

    res.status(201).json({
      success: true,
      record,
    });
  } catch (error) {
    next(error);
  }
};

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { extractTenant } from '../middleware/tenant';
import {
  createConsent,
  revokeConsent,
  getPatientConsents,
  anonymizePatient,
  exportPatientDataJSON,
  exportPatientDataPDF,
  getPatientAccessLogs,
  getProcessingReport,
  generateDeletionCertificate,
  getDeletionLogs,
  createLGPDRequest,
  listLGPDRequests,
  updateLGPDRequestStatus,
  exportOrgAuditReport,
} from '../controllers/gdprController';

const router = Router();

router.use(authenticate);
router.use(extractTenant);

// Consentimentos
router.post('/consents', createConsent);
router.put('/consents/:id/revoke', revokeConsent);
router.get('/patients/:patientId/consents', getPatientConsents);

// Exportação de dados (portabilidade)
router.get('/patients/:patientId/export/json', exportPatientDataJSON);
router.get('/patients/:patientId/export/pdf', exportPatientDataPDF);

// Logs de acesso (ROPA)
router.get('/patients/:patientId/access-logs', getPatientAccessLogs);
router.get('/patients/:patientId/processing-report', getProcessingReport);

// Direito ao esquecimento (apenas admin)
router.post('/patients/:patientId/anonymize', authorize('ADMIN'), anonymizePatient);

// Certificados de exclusão
router.get('/deletion-certificates/:certificateId', generateDeletionCertificate);
router.get('/deletion-logs', authorize('ADMIN'), getDeletionLogs);

// Solicitações LGPD (tickets com protocolo)
router.post('/requests', createLGPDRequest);
router.get('/requests', listLGPDRequests);
router.put('/requests/:id/status', authorize('ADMIN'), updateLGPDRequestStatus);

// Relatório de auditoria exportável (CSV)
router.get('/audit-report', authorize('ADMIN'), exportOrgAuditReport);

export default router;

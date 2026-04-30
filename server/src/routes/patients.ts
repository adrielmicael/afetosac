import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { extractTenant } from '../middleware/tenant';
import {
  getPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  createAppointment,
  confirmAppointment,
  getMedicalRecords,
  createMedicalRecord,
} from '../controllers/patientController';

const router = Router();

router.use(authenticate);
router.use(extractTenant);

router.get('/', getPatients);
router.get('/:id', getPatientById);
router.post('/', createPatient);
router.put('/:id', updatePatient);
router.delete('/:id', deletePatient);
router.post('/:id/appointments', createAppointment);
router.post('/appointments/:appointmentId/confirm', confirmAppointment);
router.get('/:id/records', getMedicalRecords);
router.post('/:id/records', createMedicalRecord);

export default router;

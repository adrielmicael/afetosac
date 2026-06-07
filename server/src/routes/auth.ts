import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  validateLogin,
  login,
  me,
  changePassword,
  logout,
  logoutAll,
  listSessions,
  revokeSessionById,
} from '../controllers/authController';

const router = Router();

router.post('/login', validateLogin, login);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);

// Gestão de sessão / dispositivos
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/sessions', authenticate, listSessions);
router.delete('/sessions/:id', authenticate, revokeSessionById);

export default router;

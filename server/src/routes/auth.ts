import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  validateLogin,
  login,
  me,
  updateProfile,
  changePassword,
  logout,
  logoutAll,
  listSessions,
  revokeSessionById,
} from '../controllers/authController';

const router = Router();

router.post('/login', validateLogin, login);
router.get('/me', authenticate, me);
router.patch('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);

// Gestão de sessão / dispositivos
router.post('/logout', authenticate, logout);
router.post('/logout-all', authenticate, logoutAll);
router.get('/sessions', authenticate, listSessions);
router.delete('/sessions/:id', authenticate, revokeSessionById);

export default router;

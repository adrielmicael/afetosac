import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  validateLogin,
  login,
  me,
  changePassword,
} from '../controllers/authController';

const router = Router();

router.post('/login', validateLogin, login);
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);

export default router;

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  inviteUser,
} from '../controllers/userController';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPERVISOR', 'OWNER'));

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.post('/invite', inviteUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../controllers/templateController';

const router = Router();

router.use(authenticate);

router.get('/', getTemplates);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.delete('/:id', deleteTemplate);

export default router;

import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { extractTenant } from '../middleware/tenant';
import {
  getUploadUrl,
  confirmUpload,
  uploadFile,
  deleteFile,
  listFiles,
  getBucketInfo,
} from '../controllers/uploadController';

const router = Router();

// Configuração do multer (memória)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

router.use(authenticate);
router.use(extractTenant);

// Gerar URL assinada para upload
router.post('/upload-url', getUploadUrl);

// Confirmar upload (após envio ao Supabase)
router.post('/confirm', confirmUpload);

// Upload direto
router.post('/direct', upload.single('file'), uploadFile);

// Listar arquivos do chat
router.get('/list/:chatId', listFiles);

// Deletar arquivo
router.post('/delete', deleteFile);

// Info do bucket
router.get('/bucket-info', getBucketInfo);

export default router;

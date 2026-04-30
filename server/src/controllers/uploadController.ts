import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { broadcastToChat } from '../services/realtimeService';

const getOrganizationId = (req: Request): string => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new AppError('Organization context required', 400);
  }
  return organizationId;
};

// Configuracao do Supabase Storage
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabaseClient: ReturnType<typeof createClient> | null = null;

const getSupabaseClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new AppError(
      'Upload service not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      503
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
};

const BUCKET_NAME = 'uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
};

const optimizeImageIfPossible = async (buffer: Buffer) => {
  try {
    // `sharp` pode nao estar disponivel em runtime serverless/manual deploy.
    // Nesses casos seguimos com o arquivo original em vez de derrubar a API.
    const sharpModule = require('sharp');
    const sharp = sharpModule.default || sharpModule;

    return await sharp(buffer)
      .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (error) {
    logger.warn('sharp unavailable, skipping image optimization', {
      error: error instanceof Error ? error.message : String(error),
    });
    return buffer;
  }
};

// Gerar URL assinada para upload
export const getUploadUrl = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { chatId, fileName, fileType, fileSize } = req.body;

    if (!chatId || !fileName || !fileType) {
      throw new AppError('Missing required fields', 400);
    }

    if (fileSize > MAX_FILE_SIZE) {
      throw new AppError('File too large. Maximum size is 10MB', 400);
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      select: { id: true },
    });

    if (!chat) {
      throw new AppError('Chat not found in this organization', 404);
    }

    const isAllowed = Object.values(ALLOWED_TYPES).flat().includes(fileType);
    if (!isAllowed) {
      throw new AppError('File type not allowed', 400);
    }

    const fileExt = path.extname(fileName);
    const uniqueName = `${uuidv4()}${fileExt}`;
    const filePath = `${organizationId}/${chatId}/${uniqueName}`;

    const { data, error } = await getSupabaseClient().storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(filePath);

    if (error) {
      logger.error('Supabase storage error:', error);
      throw new AppError('Failed to generate upload URL', 500);
    }

    res.json({
      success: true,
      uploadUrl: data.signedUrl,
      filePath,
      fileName: uniqueName,
      maxSize: MAX_FILE_SIZE,
    });
  } catch (error) {
    next(error);
  }
};

// Confirmar upload e criar mensagem
export const confirmUpload = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const supabase = getSupabaseClient();
    const { chatId, filePath, fileName, fileType, fileSize, caption } = req.body;
    const senderId = req.user?.id;

    const expectedPrefix = `${organizationId}/${chatId}/`;
    if (!filePath || !filePath.startsWith(expectedPrefix)) {
      throw new AppError('Invalid file path for this organization/chat', 400);
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      select: { id: true },
    });

    if (!chat) {
      throw new AppError('Chat not found in this organization', 404);
    }

    const { data: fileData } = await supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!fileData) {
      throw new AppError('File not found in storage', 404);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    let messageType = 'DOCUMENT';
    if (ALLOWED_TYPES.image.includes(fileType)) messageType = 'IMAGE';
    else if (ALLOWED_TYPES.audio.includes(fileType)) messageType = 'AUDIO';
    else if (ALLOWED_TYPES.video.includes(fileType)) messageType = 'VIDEO';

    const message = await prisma.message.create({
      data: {
        chatId,
        sender: 'BOT',
        senderId,
        type: messageType,
        content: caption || fileName,
        mediaUrl: publicUrl,
        fileName,
        fileSize: formatFileSize(fileSize),
        status: 'SENDING',
      },
      include: {
        senderUser: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    await prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageAt: new Date(),
      },
    });

    await broadcastToChat(chatId, 'message:new', message);

    logger.info(`File uploaded: ${fileName} (${fileType}) to chat ${chatId}`);

    res.json({
      success: true,
      message,
      url: publicUrl,
    });
  } catch (error) {
    next(error);
  }
};

// Upload direto (para arquivos pequenos)
export const uploadFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const supabase = getSupabaseClient();
    const { chatId, caption } = req.body;
    const file = req.file;

    if (!file) {
      throw new AppError('No file provided', 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError('File too large', 400);
    }

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      select: { id: true },
    });

    if (!chat) {
      throw new AppError('Chat not found in this organization', 404);
    }

    let fileBuffer = file.buffer;
    let fileType = file.mimetype;

    if (ALLOWED_TYPES.image.includes(fileType)) {
      fileBuffer = await optimizeImageIfPossible(file.buffer);
      fileType = 'image/jpeg';
    }

    const fileExt = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${fileExt}`;
    const filePath = `${organizationId}/${chatId}/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, fileBuffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      logger.error('Upload error:', uploadError);
      throw new AppError('Failed to upload file', 500);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    let messageType = 'DOCUMENT';
    if (ALLOWED_TYPES.image.includes(fileType)) messageType = 'IMAGE';
    else if (ALLOWED_TYPES.audio.includes(fileType)) messageType = 'AUDIO';
    else if (ALLOWED_TYPES.video.includes(fileType)) messageType = 'VIDEO';

    const message = await prisma.message.create({
      data: {
        chatId,
        sender: 'BOT',
        senderId: req.user?.id,
        type: messageType,
        content: caption || file.originalname,
        mediaUrl: publicUrl,
        fileName: file.originalname,
        fileSize: formatFileSize(file.size),
        status: 'SENDING',
      },
      include: {
        senderUser: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    await broadcastToChat(chatId, 'message:new', message);

    res.json({
      success: true,
      message,
      url: publicUrl,
    });
  } catch (error) {
    next(error);
  }
};

// Baixar arquivo recebido do WhatsApp
export const downloadWhatsAppMedia = async (
  mediaId: string,
  mimeType: string,
  chatId: string
): Promise<string | null> => {
  try {
    logger.info(`Downloading WhatsApp media: ${mediaId} for chat ${chatId} (${mimeType})`);
    return null;
  } catch (error) {
    logger.error('Error downloading WhatsApp media:', error);
    return null;
  }
};

// Deletar arquivo
export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { filePath } = req.body;

    if (!filePath || !filePath.startsWith(`${organizationId}/`)) {
      throw new AppError('Invalid file path for this organization', 400);
    }

    const { error } = await getSupabaseClient().storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw new AppError('Failed to delete file', 500);
    }

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Listar arquivos do chat
export const listFiles = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { chatId } = req.params;
    const { type, page = '1', limit = '20' } = req.query;

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, organizationId },
      select: { id: true },
    });

    if (!chat) {
      throw new AppError('Chat not found in this organization', 404);
    }

    const where: any = {
      chatId,
      chat: { organizationId },
    };
    if (type) {
      where.type = type.toString().toUpperCase();
    } else {
      where.type = { in: ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'] };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [files, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
        select: {
          id: true,
          type: true,
          content: true,
          mediaUrl: true,
          fileName: true,
          fileSize: true,
          createdAt: true,
          senderUser: {
            select: { name: true },
          },
        },
      }),
      prisma.message.count({ where }),
    ]);

    res.json({
      success: true,
      files,
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

// Helper para formatar tamanho
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Validar tipo de arquivo
export const validateFileType = (mimetype: string): boolean => {
  return Object.values(ALLOWED_TYPES).flat().includes(mimetype);
};

// Obter informacoes do bucket
export const getBucketInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const organizationId = getOrganizationId(req);
    const { data, error } = await getSupabaseClient().storage
      .from(BUCKET_NAME)
      .list(organizationId, { limit: 1000 });

    if (error) {
      throw new AppError('Failed to get bucket info', 500);
    }

    const totalSize = data?.reduce((acc, file) => acc + (file.metadata?.size || 0), 0) || 0;
    const fileCount = data?.length || 0;

    res.json({
      success: true,
      bucket: BUCKET_NAME,
      totalSize: formatFileSize(totalSize),
      totalSizeBytes: totalSize,
      fileCount,
      maxFileSize: formatFileSize(MAX_FILE_SIZE),
      allowedTypes: ALLOWED_TYPES,
    });
  } catch (error) {
    next(error);
  }
};

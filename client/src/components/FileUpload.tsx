import { useState, useRef, useCallback } from 'react';
import { Upload, X, File, Image, Music, Video, Loader2 } from 'lucide-react';
import { uploadApi } from '../services/api';
import toast from 'react-hot-toast';

interface FileUploadProps {
  chatId: string;
  onUploadComplete: (message: any) => void;
  onCancel: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = {
  'image/*': ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  'application/pdf': ['application/pdf'],
  'audio/*': ['audio/mpeg', 'audio/ogg', 'audio/wav'],
  'video/*': ['video/mp4', 'video/webm'],
};

export function FileUpload({ chatId, onUploadComplete, onCancel }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      validateAndSelectFile(file);
    }
  }, []);

  const validateAndSelectFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande. Máximo: 10MB');
      return;
    }

    const allowedTypes = Object.values(ALLOWED_TYPES).flat();
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido');
      return;
    }

    setSelectedFile(file);

    // Gerar preview para imagens
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-8 h-8 text-blue-500" />;
    if (type.startsWith('audio/')) return <Music className="w-8 h-8 text-purple-500" />;
    if (type.startsWith('video/')) return <Video className="w-8 h-8 text-red-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Método 1: Upload direto
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('chatId', chatId);
      formData.append('caption', caption);

      const response = await uploadApi.uploadDirect(formData, (progress) => {
        setUploadProgress(progress);
      });

      toast.success('Arquivo enviado com sucesso!');
      onUploadComplete(response.data.message);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao enviar arquivo');
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (selectedFile) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Enviar Arquivo</h3>
          <button
            onClick={clearSelection}
            className="p-1 hover:bg-gray-100 rounded-full"
            disabled={isUploading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg mb-4">
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg"
            />
          ) : (
            getFileIcon(selectedFile.type)
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
            <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Legenda (opcional)
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Adicione uma descrição..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            disabled={isUploading}
          />
        </div>

        {isUploading && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Enviando...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isUploading}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Enviar
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-white rounded-xl shadow-lg p-8 max-w-md w-full transition-colors ${
        isDragging ? 'bg-primary-50 border-2 border-primary-400 border-dashed' : ''
      }`}
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8 text-primary-600" />
        </div>
        
        <h3 className="font-semibold text-gray-900 mb-2">Arraste arquivos aqui</h3>
        <p className="text-sm text-gray-500 mb-4">ou clique para selecionar</p>
        
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          accept="image/*,.pdf,audio/*,video/*"
          className="hidden"
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Selecionar Arquivo
        </button>
        
        <p className="text-xs text-gray-400 mt-4">
          Máximo: 10MB | Formatos: Imagens, PDF, Áudio, Vídeo
        </p>
      </div>
    </div>
  );
}

export default FileUpload;

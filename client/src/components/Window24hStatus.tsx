import { useEffect, useState } from 'react';
import { Clock, Lock, Unlock, Send } from 'lucide-react';
import { window24hApi } from '../services/api';

interface WindowStatus {
  isOpen: boolean;
  is24hOpen: boolean;
  windowExpires: string;
  lastMessageAt: string;
  timeRemaining: { hours: number; minutes: number } | null;
  canSendMessage: boolean;
  canSendTemplate: boolean;
}

interface Window24hStatusProps {
  chatId: string;
  onReopenWindow: () => void;
}

export function Window24hStatus({ chatId, onReopenWindow }: Window24hStatusProps) {
  const [status, setStatus] = useState<WindowStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await window24hApi.checkStatus(chatId);
        setStatus(response.data.window);
      } catch (error) {
        console.error('Error checking window status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [chatId]);

  if (isLoading || !status) return null;

  // Janela aberta - não mostrar alerta
  if (status.isOpen) {
    return (
      <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
        <Unlock className="w-3.5 h-3.5" />
        <span>Janela 24h aberta</span>
        {status.timeRemaining && status.timeRemaining.hours < 4 && (
          <span className="text-amber-600">
            (fecha em {status.timeRemaining.hours}h {status.timeRemaining.minutes}m)
          </span>
        )}
      </div>
    );
  }

  // Janela fechada - mostrar alerta
  return (
    <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-orange-100 rounded-full">
          <Lock className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-orange-900">
            Janela de 24h fechada
          </h3>
          <p className="text-sm text-orange-700 mt-1">
            Não é possível enviar mensagens fora da janela de 24h. 
            Envie um template HSM para reabrir a conversa.
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-orange-600">
            <Clock className="w-4 h-4" />
            <span>
              Última mensagem: {new Date(status.lastMessageAt).toLocaleString('pt-BR')}
            </span>
          </div>
          <button
            onClick={onReopenWindow}
            className="mt-3 flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Send className="w-4 h-4" />
            Enviar Template para Reabrir
          </button>
        </div>
      </div>
    </div>
  );
}

export default Window24hStatus;

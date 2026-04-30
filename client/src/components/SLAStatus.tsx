import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { slaApi } from '../services/api';

interface SLAStatusProps {
  chatId: string;
}

interface SLAData {
  config: {
    name: string;
    firstResponseMinutes: number;
    resolutionMinutes: number;
  };
  firstResponse: {
    time: number | null;
    status: 'PENDING' | 'WITHIN_SLA' | 'BREACHED';
    target: number;
  };
  resolution: {
    totalTime: number;
    status: 'PENDING' | 'WITHIN_SLA' | 'WARNING' | 'BREACHED';
    target: number;
    remainingTime: { hours: number; minutes: number } | null;
  };
  statusColor: 'green' | 'yellow' | 'red';
}

export function SLAStatus({ chatId }: SLAStatusProps) {
  const [sla, setSLA] = useState<SLAData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSLA = async () => {
      try {
        const response = await slaApi.getChatStatus(chatId);
        if (response.data.sla) {
          setSLA(response.data.sla);
        }
      } catch (error) {
        console.error('Error fetching SLA:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSLA();
    const interval = setInterval(fetchSLA, 60000); // Atualizar a cada minuto
    return () => clearInterval(interval);
  }, [chatId]);

  if (isLoading || !sla) return null;

  const getStatusIcon = () => {
    switch (sla.statusColor) {
      case 'green':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'yellow':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'red':
        return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBg = () => {
    switch (sla.statusColor) {
      case 'green':
        return 'bg-green-50 border-green-200';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200';
      case 'red':
        return 'bg-red-50 border-red-200';
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <div className={`rounded-lg border p-3 ${getStatusBg()}`}>
      <div className="flex items-center gap-2 mb-2">
        {getStatusIcon()}
        <span className="font-medium text-sm">SLA: {sla.config.name}</span>
      </div>

      <div className="space-y-2 text-sm">
        {/* Primeira Resposta */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Primeira resposta:</span>
          <div className="flex items-center gap-1">
            {sla.firstResponse.status === 'PENDING' ? (
              <span className="text-yellow-600">Pendente</span>
            ) : sla.firstResponse.status === 'WITHIN_SLA' ? (
              <span className="text-green-600">✓ {formatTime(sla.firstResponse.time!)} (meta: {formatTime(sla.firstResponse.target)})</span>
            ) : (
              <span className="text-red-600">✗ {formatTime(sla.firstResponse.time!)} (meta: {formatTime(sla.firstResponse.target)})</span>
            )}
          </div>
        </div>

        {/* Resolução */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Tempo total:</span>
          <div className="flex items-center gap-1">
            {sla.resolution.status === 'BREACHED' ? (
              <span className="text-red-600 font-medium">✗ {formatTime(sla.resolution.totalTime)}</span>
            ) : sla.resolution.status === 'WARNING' ? (
              <span className="text-yellow-600 font-medium">⚠ {formatTime(sla.resolution.totalTime)}</span>
            ) : (
              <span className="text-green-600">{formatTime(sla.resolution.totalTime)}</span>
            )}
            <span className="text-gray-400">/ {formatTime(sla.resolution.target)}</span>
          </div>
        </div>

        {/* Tempo Restante */}
        {sla.resolution.remainingTime && sla.resolution.status !== 'BREACHED' && (
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500">Tempo restante:</span>
            <span className={`font-medium ${
              sla.resolution.status === 'WARNING' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {sla.resolution.remainingTime.hours}h {sla.resolution.remainingTime.minutes}m
            </span>
          </div>
        )}

        {/* Meta Excedida */}
        {sla.resolution.status === 'BREACHED' && (
          <div className="text-xs text-red-600 mt-2 p-2 bg-red-100 rounded">
            Meta de resolução excedida!
          </div>
        )}
      </div>
    </div>
  );
}

export default SLAStatus;

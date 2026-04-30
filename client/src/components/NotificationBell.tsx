import { useState, useEffect, useRef } from 'react';
import { Bell, MessageSquare, Clock, CheckCheck } from 'lucide-react';
import { chatsApi } from '../services/api';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notification {
  id: string;
  type: 'waiting' | 'assigned';
  title: string;
  message: string;
  chatId: string;
  createdAt: Date;
  read: boolean;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Busca chats aguardando e gera notificações
  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await chatsApi.getAll({ status: 'WAITING' });
        const chats = res.data.chats ?? [];

        const newNotifs: Notification[] = chats.slice(0, 10).map((c: any) => ({
          id: c.id,
          type: 'waiting' as const,
          title: 'Atendimento aguardando',
          message: c.name || 'Paciente sem nome',
          chatId: c.id,
          createdAt: new Date(c.lastMessageAt || c.createdAt),
          read: false,
        }));

        setNotifications((prev) => {
          // Preserva estado de lido dos anteriores
          const readIds = new Set(prev.filter((n) => n.read).map((n) => n.id));
          return newNotifs.map((n) => ({ ...n, read: readIds.has(n.id) }));
        });
      } catch {
        // silencia erro de polling
      }
    };

    fetch();
    const interval = setInterval(fetch, 30000);
    return () => clearInterval(interval);
  }, []);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Notificações {unread > 0 && <span className="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unread}</span>}
            </h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar lidas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n.id}
                  to={`/chats/${n.chatId}`}
                  onClick={() => { markRead(n.id); setOpen(false); }}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${!n.read ? 'bg-primary-50' : ''}`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${n.type === 'waiting' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                    {n.type === 'waiting'
                      ? <Clock className="w-3.5 h-3.5 text-orange-600" />
                      : <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800">{n.title}</p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {formatDistanceToNow(n.createdAt, { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-1" />
                  )}
                </Link>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100">
              <Link
                to="/chats"
                onClick={() => setOpen(false)}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                Ver todas as conversas →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

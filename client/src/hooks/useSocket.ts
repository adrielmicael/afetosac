import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useChatStore, useAuthStore } from '../store';
import toast from 'react-hot-toast';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore();
  const {
    activeChat,
    addMessage,
    updateChat,
    setTyping,
  } = useChatStore();

  useEffect(() => {
    if (!user) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
    const isProd = import.meta.env.PROD;

    // Netlify Functions não mantém conexões Socket.IO estáveis.
    // Em produção, só conecta se houver endpoint realtime dedicado configurado.
    if (isProd && !socketUrl) {
      console.info('Socket desativado em produção: defina VITE_SOCKET_URL para habilitar realtime.');
      return;
    }

    const socket = io(socketUrl || window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('message:new', (message: any) => {
      addMessage(message.chatId, message);

      // If not active chat, increment unread
      if (activeChat?.id !== message.chatId) {
        // Update unread count
      }

      // Show notification if from client
      if (message.sender === 'CLIENT') {
        toast(`Nova mensagem de ${message.chat?.name || 'Cliente'}`, {
          icon: '💬',
        });
      }
    });

    socket.on('chat:assigned', (chat: any) => {
      updateChat(chat.id, chat);
      toast.success(`Chat assumido por ${chat.agent?.name}`);
    });

    socket.on('chat:transferred', (chat: any) => {
      updateChat(chat.id, chat);
      toast(`Chat transferido para ${chat.agent?.name}`);
    });

    socket.on('chat:closed', (chat: any) => {
      updateChat(chat.id, chat);
      toast('Atendimento finalizado');
    });

    socket.on('typing:start', (data: { chatId: string }) => {
      setTyping(data.chatId, true);
    });

    socket.on('typing:stop', (data: { chatId: string }) => {
      setTyping(data.chatId, false);
    });

    socket.on('messages:read', (_data: { chatId: string }) => {
      // Update message statuses
    });

    return () => {
      socket.disconnect();
    };
  }, [user, activeChat?.id]);

  const joinChat = (chatId: string) => {
    socketRef.current?.emit('chat:join', chatId);
  };

  const leaveChat = (chatId: string) => {
    socketRef.current?.emit('chat:leave', chatId);
  };

  const sendTyping = (chatId: string) => {
    socketRef.current?.emit('typing:start', { chatId, userId: user?.id });
  };

  const stopTyping = (chatId: string) => {
    socketRef.current?.emit('typing:stop', { chatId, userId: user?.id });
  };

  return {
    socket: socketRef.current,
    joinChat,
    leaveChat,
    sendTyping,
    stopTyping,
  };
};

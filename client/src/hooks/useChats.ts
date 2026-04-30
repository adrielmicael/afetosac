import { useState, useCallback } from 'react';
import { chatsApi, messagesApi } from '../services/api';
import { useChatStore } from '../store';
import toast from 'react-hot-toast';

export const useChats = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { chats, setChats, activeChat, setActiveChat, setMessages } = useChatStore();

  const fetchChats = useCallback(async (filters?: { status?: string; search?: string }) => {
    try {
      const response = await chatsApi.getAll(filters);
      setChats(response.data.chats);
    } catch (error) {
      toast.error('Erro ao carregar conversas');
    }
  }, [setChats]);

  const fetchChat = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const [chatResponse, messagesResponse] = await Promise.all([
        chatsApi.getById(id),
        messagesApi.getByChatId(id),
      ]);
      setActiveChat(chatResponse.data.chat);
      setMessages(id, messagesResponse.data.messages);
    } catch (error) {
      toast.error('Erro ao carregar conversa');
    } finally {
      setIsLoading(false);
    }
  }, [setActiveChat, setMessages]);

  const assignChat = async (id: string) => {
    try {
      await chatsApi.assign(id);
      toast.success('Conversa assumida!');
    } catch (error) {
      toast.error('Erro ao assumir conversa');
    }
  };

  const closeChat = async (id: string) => {
    try {
      await chatsApi.close(id);
      toast.success('Atendimento finalizado!');
    } catch (error) {
      toast.error('Erro ao finalizar atendimento');
    }
  };

  const sendMessage = async (
    chatId: string,
    content: string,
    options?: { isInternal?: boolean; replyToId?: string }
  ) => {
    try {
      await messagesApi.send(chatId, {
        content,
        isInternal: options?.isInternal,
        replyToId: options?.replyToId,
      });
    } catch (error) {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const sendTemplate = async (chatId: string, templateName: string, variables?: string[]) => {
    try {
      await messagesApi.sendTemplate(chatId, { templateName, variables });
      toast.success('Template enviado!');
    } catch (error) {
      toast.error('Erro ao enviar template');
    }
  };

  const markAsRead = async (chatId: string) => {
    try {
      await messagesApi.markAsRead(chatId);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  return {
    chats,
    activeChat,
    isLoading,
    fetchChats,
    fetchChat,
    assignChat,
    closeChat,
    sendMessage,
    sendTemplate,
    markAsRead,
  };
};

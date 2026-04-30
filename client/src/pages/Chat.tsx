import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Send,
  Clock,
  Check,
  CheckCheck,
  X,
  CornerUpLeft,
  Zap,
  Lock,
  Unlock,
} from 'lucide-react';
import { format } from 'date-fns';
import { chatsApi, messagesApi, quickRepliesApi } from '../services/api';
import { useChatStore, useAuthStore, useUIStore } from '../store';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

export default function Chat() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    chats,
    activeChat,
    messages,
    setChats,
    setActiveChat,
    setMessages,
    addMessage,
    updateMessage,
    typingChats,
  } = useChatStore();
  const {
    searchTerm,
    filterStatus,
    isInternalNote,
    setIsInternalNote,
    replyingTo,
    setReplyingTo,
    showQuickReplies,
    setShowQuickReplies,
  } = useUIStore();

  const [messageText, setMessageText] = useState('');
  const [quickReplies, setQuickReplies] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { joinChat, leaveChat } = useSocket();

  // Fetch chats list
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const response = await chatsApi.getAll({
          status: filterStatus === 'all' ? undefined : filterStatus,
          search: searchTerm || undefined,
        });
        setChats(response.data.chats);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };

    fetchChats();
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, [filterStatus, searchTerm, setChats]);

  // Fetch active chat
  useEffect(() => {
    if (!chatId) return;

    const fetchChat = async () => {
      try {
        const [chatResponse, messagesResponse] = await Promise.all([
          chatsApi.getById(chatId),
          messagesApi.getByChatId(chatId),
        ]);
        setActiveChat(chatResponse.data.chat);
        setMessages(chatId, messagesResponse.data.messages);
        joinChat(chatId);
        messagesApi.markAsRead(chatId);
      } catch (error) {
        toast.error('Erro ao carregar conversa');
      }
    };

    fetchChat();

    return () => {
      leaveChat(chatId);
    };
  }, [chatId, setActiveChat, setMessages, joinChat, leaveChat]);

  // Fetch quick replies
  useEffect(() => {
    const fetchQuickReplies = async () => {
      try {
        const response = await quickRepliesApi.getAll();
        setQuickReplies(response.data.replies);
      } catch (error) {
        console.error('Error fetching quick replies:', error);
      }
    };

    fetchQuickReplies();
  }, []);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatId]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !chatId) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      chatId,
      sender: isInternalNote ? 'AGENT' : 'BOT',
      senderId: user?.id,
      senderUser: { id: user?.id, name: user?.name },
      type: 'TEXT',
      content: messageText,
      isInternal: isInternalNote,
      status: isInternalNote ? 'SAVED' : 'SENDING',
      replyTo: replyingTo,
      createdAt: new Date().toISOString(),
    };

    addMessage(chatId, tempMessage);
    setMessageText('');
    setReplyingTo(null);

    try {
      const response = await messagesApi.send(chatId, {
        content: tempMessage.content,
        isInternal: tempMessage.isInternal,
        replyToId: replyingTo?.id,
      });

      updateMessage(chatId, tempId, {
        ...response.data.message,
        status: response.data.message.status,
      });
    } catch (error) {
      updateMessage(chatId, tempId, { status: 'FAILED' });
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAssumirChat = async () => {
    if (!chatId) return;
    try {
      await chatsApi.assign(chatId);
      toast.success('Chat assumido com sucesso!');
    } catch (error) {
      toast.error('Erro ao assumir chat');
    }
  };

  const handleCloseChat = async () => {
    if (!chatId) return;
    if (!confirm('Deseja finalizar este atendimento?')) return;
    try {
      await chatsApi.close(chatId);
      toast.success('Atendimento finalizado!');
    } catch (error) {
      toast.error('Erro ao finalizar atendimento');
    }
  };

  const currentMessages = chatId ? messages[chatId] || [] : [];
  const isTyping = chatId ? typingChats[chatId] : false;

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Chat List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => useUIStore.setState({ searchTerm: e.target.value })}
            />
          </div>
          <div className="flex gap-2 mt-3">
            {['all', 'WAITING', 'IN_PROGRESS'].map((status) => (
              <button
                key={status}
                onClick={() => useUIStore.setState({ filterStatus: status })}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  filterStatus === status
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status === 'all'
                  ? 'Todas'
                  : status === 'WAITING'
                  ? 'Aguardando'
                  : 'Em atendimento'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => navigate(`/chats/${chat.id}`)}
              className={`w-full p-4 flex items-start gap-3 hover:bg-gray-50 transition-colors border-l-4 ${
                chatId === chat.id
                  ? 'bg-primary-50 border-l-primary-600'
                  : 'border-l-transparent'
              }`}
            >
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-medium text-gray-600">
                  {chat.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex justify-between items-start">
                  <p className="font-medium text-gray-900 truncate">{chat.name}</p>
                  <span className="text-xs text-gray-400">
                    {chat.lastMessageAt &&
                      format(new Date(chat.lastMessageAt), 'HH:mm')}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  {chat.lastMessage || 'Sem mensagens'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {chat.unreadCount > 0 && (
                    <span className="bg-primary-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                      {chat.unreadCount}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      chat.status === 'WAITING'
                        ? 'bg-orange-100 text-orange-700'
                        : chat.status === 'IN_PROGRESS'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {chat.status === 'WAITING'
                      ? 'Aguardando'
                      : chat.status === 'IN_PROGRESS'
                      ? 'Em atendimento'
                      : 'Finalizado'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="font-medium text-primary-700">
                    {activeChat.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">{activeChat.name}</h2>
                  <div className="flex items-center gap-2">
                    {isTyping ? (
                      <p className="text-sm text-primary-600 italic">Digitando...</p>
                    ) : activeChat.status === 'WAITING' ? (
                      <p className="text-sm text-orange-600">Aguardando atendimento</p>
                    ) : (
                      <p className="text-sm text-green-600">
                        Atendido por: {activeChat.agent?.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeChat.status === 'WAITING' && (
                  <button
                    onClick={handleAssumirChat}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Assumir
                  </button>
                )}
                <button
                  onClick={handleCloseChat}
                  className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Finalizar
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {currentMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.sender === 'CLIENT' ? 'justify-start' : 'justify-end'
                  }`}
                >
                  <div
                    className={`max-w-[70%] ${
                      message.isInternal
                        ? 'bg-amber-100'
                        : message.sender === 'CLIENT'
                        ? 'bg-white'
                        : 'bg-primary-100'
                    } rounded-2xl px-4 py-2 shadow-sm`}
                  >
                    {message.isInternal && (
                      <div className="flex items-center gap-1 text-amber-700 text-xs mb-1">
                        <Lock className="w-3 h-3" />
                        <span>Nota Interna</span>
                      </div>
                    )}

                    {message.replyTo && (
                      <div className="bg-black/5 rounded-lg p-2 mb-2 text-sm">
                        <p className="font-medium text-primary-700">
                          {message.replyTo.sender === 'CLIENT'
                            ? activeChat.name
                            : 'Você'}
                        </p>
                        <p className="text-gray-600 truncate">{message.replyTo.content}</p>
                      </div>
                    )}

                    <p className="text-gray-800">{message.content}</p>

                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs text-gray-400">
                        {format(new Date(message.createdAt), 'HH:mm')}
                      </span>
                      {message.sender !== 'CLIENT' && !message.isInternal && (
                        <>
                          {message.status === 'SENDING' && (
                            <Clock className="w-3 h-3 text-gray-400" />
                          )}
                          {message.status === 'DELIVERED' && (
                            <Check className="w-3 h-3 text-gray-400" />
                          )}
                          {message.status === 'READ' && (
                            <CheckCheck className="w-3 h-3 text-primary-500" />
                          )}
                          {message.status === 'FAILED' && (
                            <X className="w-3 h-3 text-red-500" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200">
              {replyingTo && (
                <div className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2 mb-2">
                  <div className="flex items-center gap-2">
                    <CornerUpLeft className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">
                      Respondendo: {replyingTo.content.substring(0, 50)}...
                    </span>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsInternalNote(!isInternalNote)}
                  className={`p-2 rounded-lg transition-colors ${
                    isInternalNote
                      ? 'bg-amber-100 text-amber-700'
                      : 'hover:bg-gray-100 text-gray-500'
                  }`}
                  title="Nota interna"
                >
                  {isInternalNote ? (
                    <Lock className="w-5 h-5" />
                  ) : (
                    <Unlock className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                >
                  <Zap className="w-5 h-5" />
                </button>

                {showQuickReplies && (
                  <div className="absolute bottom-20 left-80 bg-white border border-gray-200 rounded-xl shadow-lg p-2 w-64">
                    <div className="flex justify-between items-center p-2 border-b">
                      <span className="font-medium text-sm">Respostas Rápidas</span>
                      <button onClick={() => setShowQuickReplies(false)}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {quickReplies.map((reply) => (
                        <button
                          key={reply.id}
                          onClick={() => {
                            setMessageText(reply.content);
                            setShowQuickReplies(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg text-sm"
                        >
                          {reply.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isInternalNote
                        ? 'Adicionar nota interna...'
                        : 'Digite sua mensagem...'
                    }
                    className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:outline-none ${
                      isInternalNote
                        ? 'border-amber-300 focus:ring-amber-500 bg-amber-50'
                        : 'border-gray-300 focus:ring-primary-500'
                    }`}
                  />
                </div>

                <button
                  onClick={handleSendMessage}
                  disabled={!messageText.trim()}
                  className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Selecione uma conversa para começar
          </div>
        )}
      </div>
    </div>
  );
}

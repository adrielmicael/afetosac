import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Chat } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Record<string, any[]>;
  unreadCounts: Record<string, number>;
  typingChats: Record<string, boolean>;
  setChats: (chats: Chat[]) => void;
  setActiveChat: (chat: Chat | null) => void;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  setMessages: (chatId: string, messages: any[]) => void;
  addMessage: (chatId: string, message: any) => void;
  updateMessage: (chatId: string, messageId: string, updates: any) => void;
  setUnreadCount: (chatId: string, count: number) => void;
  setTyping: (chatId: string, isTyping: boolean) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  chats: [],
  activeChat: null,
  messages: {},
  unreadCounts: {},
  typingChats: {},
  setChats: (chats) => set({ chats }),
  setActiveChat: (chat) => set({ activeChat: chat }),
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
  updateChat: (chatId, updates) =>
    set((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, ...updates } : c
      ),
      activeChat:
        state.activeChat?.id === chatId
          ? { ...state.activeChat, ...updates }
          : state.activeChat,
    })),
  setMessages: (chatId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [chatId]: messages },
    })),
  addMessage: (chatId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: [...(state.messages[chatId] || []), message],
      },
    })),
  updateMessage: (chatId, messageId, updates) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),
  setUnreadCount: (chatId, count) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [chatId]: count },
    })),
  setTyping: (chatId, isTyping) =>
    set((state) => ({
      typingChats: { ...state.typingChats, [chatId]: isTyping },
    })),
}));

interface UIState {
  sidebarOpen: boolean;
  showPatientPanel: boolean;
  showTemplates: boolean;
  showQuickReplies: boolean;
  showAttachments: boolean;
  isInternalNote: boolean;
  replyingTo: any | null;
  searchTerm: string;
  filterStatus: string;
  toggleSidebar: () => void;
  setShowPatientPanel: (show: boolean) => void;
  setShowTemplates: (show: boolean) => void;
  setShowQuickReplies: (show: boolean) => void;
  setShowAttachments: (show: boolean) => void;
  setIsInternalNote: (isInternal: boolean) => void;
  setReplyingTo: (message: any | null) => void;
  setSearchTerm: (term: string) => void;
  setFilterStatus: (status: string) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  showPatientPanel: true,
  showTemplates: false,
  showQuickReplies: false,
  showAttachments: false,
  isInternalNote: false,
  replyingTo: null,
  searchTerm: '',
  filterStatus: 'all',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setShowPatientPanel: (show) => set({ showPatientPanel: show }),
  setShowTemplates: (show) => set({ showTemplates: show }),
  setShowQuickReplies: (show) => set({ showQuickReplies: show }),
  setShowAttachments: (show) => set({ showAttachments: show }),
  setIsInternalNote: (isInternal) => set({ isInternalNote: isInternal }),
  setReplyingTo: (message) => set({ replyingTo: message }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setFilterStatus: (status) => set({ filterStatus: status }),
}));

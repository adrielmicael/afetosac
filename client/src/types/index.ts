export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'AGENT' | 'SUPERVISOR';
  avatar?: string;
  createdAt?: string;
}

export interface Patient {
  id: string;
  name: string;
  age?: string;
  phone: string;
  email?: string;
  responsible?: string;
  therapies: Therapy[];
  allergies?: string;
  observations?: string;
  isActive: boolean;
  createdAt: string;
  appointments?: Appointment[];
  records?: MedicalRecord[];
  _count?: {
    appointments: number;
    chats: number;
  };
}

export interface Therapy {
  id: string;
  name: string;
  description?: string;
  color: string;
}

export interface Chat {
  id: string;
  phone: string;
  name: string;
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'TELEGRAM';
  status: 'WAITING' | 'IN_PROGRESS' | 'CLOSED';
  agentId?: string;
  patientId?: string;
  agent?: {
    id: string;
    name: string;
    avatar?: string;
  };
  patient?: Patient;
  is24hOpen: boolean;
  windowExpires?: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessage?: string;
  tags: Tag[];
  isTyping?: boolean;
  _count?: {
    messages: number;
  };
}

export interface Tag {
  id: string;
  label: string;
  color: string;
}

export interface Message {
  id: string;
  chatId: string;
  sender: 'CLIENT' | 'AGENT' | 'BOT' | 'SYSTEM';
  senderId?: string;
  senderUser?: {
    id: string;
    name: string;
    avatar?: string;
  };
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'DOCUMENT' | 'VIDEO' | 'LOCATION' | 'TEMPLATE';
  content: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  isInternal: boolean;
  status: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SAVED';
  replyToId?: string;
  replyTo?: {
    id: string;
    content: string;
    sender: string;
    type: string;
  };
  buttons?: string[];
  createdAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  date: string;
  therapy: string;
  status: 'SCHEDULED' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  notes?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  date: string;
  professional: string;
  content: string;
  type: string;
}

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  category?: string;
  isActive: boolean;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  content: string;
  variables?: string;
  category: string;
  isActive: boolean;
}

export interface DashboardStats {
  totalChats: number;
  activeChats: number;
  waitingChats: number;
  totalPatients: number;
  totalMessages: number;
  todayMessages: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Clock,
  TrendingUp,
  CheckCircle,
  UserCheck,
  BarChart2,
  ArrowRight,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalChats: number;
  activeChats: number;
  waitingChats: number;
  totalPatients: number;
  totalMessages: number;
  todayMessages: number;
}

interface Agent {
  id: string;
  name: string;
  _count: { assignedChats: number };
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await dashboardApi.getStats();
        setStats(response.data.stats);
        setRecentChats(response.data.recentChats);
        setAgents(response.data.agents || []);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      name: 'Conversas Ativas',
      value: stats?.activeChats || 0,
      icon: MessageSquare,
      color: 'bg-blue-500',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      link: '/chats',
    },
    {
      name: 'Aguardando',
      value: stats?.waitingChats || 0,
      icon: Clock,
      color: 'bg-orange-500',
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      link: '/chats',
    },
    {
      name: 'Total de Pacientes',
      value: stats?.totalPatients || 0,
      icon: Users,
      color: 'bg-green-500',
      bg: 'bg-green-50',
      text: 'text-green-700',
      link: '/patients',
    },
    {
      name: 'Mensagens Hoje',
      value: stats?.todayMessages || 0,
      icon: TrendingUp,
      color: 'bg-purple-500',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      link: '/chats',
    },
    {
      name: 'Total de Conversas',
      value: stats?.totalChats || 0,
      icon: BarChart2,
      color: 'bg-indigo-500',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
      link: '/chats',
    },
    {
      name: 'Total de Mensagens',
      value: stats?.totalMessages || 0,
      icon: CheckCircle,
      color: 'bg-teal-500',
      bg: 'bg-teal-50',
      text: 'text-teal-700',
      link: '/chats',
    },
  ];

  const maxAgentChats = Math.max(...agents.map((a) => a._count.assignedChats), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <span className="text-sm text-gray-400">Atualiza a cada 30s</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.name}
              to={card.link}
              className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <div className={`inline-flex p-2 rounded-lg ${card.bg} mb-3`}>
                <Icon className={`w-5 h-5 ${card.text}`} />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '—' : card.value.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-gray-500 mt-1">{card.name}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversas Recentes */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Conversas Recentes</h2>
            <Link to="/chats" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="p-6 text-center text-gray-400">Carregando...</div>
            ) : recentChats.length === 0 ? (
              <div className="p-6 text-center text-gray-400">Nenhuma conversa recente</div>
            ) : (
              recentChats.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/chats/${chat.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-primary-700 font-semibold text-sm">
                        {chat.name?.charAt(0) ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{chat.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {chat.patient?.name || 'Sem paciente vinculado'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="text-xs text-gray-400 mb-1">
                      {format(new Date(chat.lastMessageAt), 'HH:mm', { locale: ptBR })}
                    </p>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        chat.status === 'WAITING'
                          ? 'bg-orange-100 text-orange-700'
                          : chat.status === 'IN_PROGRESS'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {chat.status === 'WAITING'
                        ? 'Aguardando'
                        : chat.status === 'IN_PROGRESS'
                        ? 'Em atendimento'
                        : 'Finalizado'}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Performance de Agentes */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Agentes</h2>
            <Link to="/team" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Equipe <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="p-6 space-y-4">
            {isLoading ? (
              <div className="text-center text-gray-400">Carregando...</div>
            ) : agents.length === 0 ? (
              <div className="text-center text-gray-400 text-sm">Nenhum agente ativo</div>
            ) : (
              agents.map((agent) => (
                <div key={agent.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-3.5 h-3.5 text-primary-700" />
                      </div>
                      <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      {agent._count.assignedChats}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${(agent._count.assignedChats / maxAgentChats) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="px-6 pb-4">
            <Link
              to="/reports"
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <BarChart2 className="w-4 h-4" /> Ver Relatórios
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


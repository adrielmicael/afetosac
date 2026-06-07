import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Users,
  Settings,
  LayoutDashboard,
  Heart,
  BarChart2,
  UsersRound,
} from 'lucide-react';
import { organizationsApi } from '../services/api';

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const location = useLocation();
  const [org, setOrg] = useState<{ name: string; plan: string } | null>(null);

  useEffect(() => {
    organizationsApi
      .getCurrent()
      .then((r) => setOrg({ name: r.data.organization.name, plan: r.data.organization.plan }))
      .catch(() => undefined);
  }, []);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Conversas', href: '/chats', icon: MessageSquare },
    { name: 'Pacientes', href: '/patients', icon: Users },
    { name: 'Equipe', href: '/team', icon: UsersRound },
    { name: 'Relatórios', href: '/reports', icon: BarChart2 },
    { name: 'Configurações', href: '/settings', icon: Settings },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-64 bg-primary-700 text-white flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
          <Heart className="w-6 h-6 text-primary-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Afeto SAC</h1>
          <p className="text-xs text-primary-200">Sistema de Atendimento</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href ||
            (item.href !== '/' && location.pathname.startsWith(item.href));
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary-800 text-white'
                  : 'text-primary-100 hover:bg-primary-600 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-primary-600">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">{(org?.name || 'C').charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{org?.name || 'Clínica'}</p>
            <p className="text-xs text-primary-200">{org ? `Plano ${org.plan}` : '—'}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

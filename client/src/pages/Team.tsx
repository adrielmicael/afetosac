import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Shield,
  UserCheck,
  Mail,
  Search,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { usersApi } from '../services/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

const ROLES = [
  { value: 'AGENT', label: 'Agente', color: 'bg-blue-100 text-blue-700' },
  { value: 'SUPERVISOR', label: 'Supervisor', color: 'bg-purple-100 text-purple-700' },
  { value: 'ADMIN', label: 'Admin', color: 'bg-orange-100 text-orange-700' },
  { value: 'OWNER', label: 'Proprietário', color: 'bg-red-100 text-red-700' },
];

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role) ?? { label: role, color: 'bg-gray-100 text-gray-700' };
}

export default function Team() {
  const { user: currentUser } = useAuthStore();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'AGENT' });
  const [isInviting, setIsInviting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isAdmin = ['ADMIN', 'OWNER'].includes(currentUser?.role ?? '');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await usersApi.getAll();
      setMembers(res.data.users);
    } catch {
      toast.error('Erro ao carregar equipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const res = await usersApi.invite(inviteForm);
      toast.success('Membro adicionado com sucesso!');
      setTempPassword(res.data.user.tempPassword);
      setInviteForm({ name: '', email: '', role: 'AGENT' });
      fetchMembers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao convidar membro');
    } finally {
      setIsInviting(false);
    }
  };

  const handleChangeRole = async (userId: string, role: string) => {
    try {
      await usersApi.update(userId, { role });
      toast.success('Papel atualizado');
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? { ...m, role } : m))
      );
    } catch {
      toast.error('Erro ao atualizar papel');
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remover ${name} da equipe?`)) return;
    try {
      await usersApi.delete(userId);
      toast.success('Membro removido');
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } catch {
      toast.error('Erro ao remover membro');
    }
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} membro{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Adicionar Membro
          </button>
        )}
      </div>

      {/* Barra de busca */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar membro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum membro encontrado</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Membro</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Papel</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Atendimentos</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Desde</th>
                {isAdmin && <th className="px-6 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((member) => {
                const rl = roleLabel(member.role);
                const isSelf = member.id === currentUser?.id;
                return (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-primary-700 font-semibold text-sm">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {member.name} {isSelf && <span className="text-xs text-gray-400">(você)</span>}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {member.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin && !isSelf ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${rl.color}`}>
                          <Shield className="w-3 h-3" /> {rl.label}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-700">
                        <UserCheck className="w-4 h-4 text-gray-400" />
                        {member._count?.assignedChats ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {!isSelf && (
                          <button
                            onClick={() => handleRemove(member.id, member.name)}
                            className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded"
                            title="Remover membro"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de invite */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Adicionar Membro</h2>
              <button onClick={() => { setShowInvite(false); setTempPassword(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {tempPassword ? (
              <div className="p-6 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800 font-medium mb-2">Membro adicionado com sucesso!</p>
                  <p className="text-xs text-green-700 mb-3">
                    Compartilhe a senha temporária abaixo. O membro poderá alterá-la após o primeiro login.
                  </p>
                  <div className="flex items-center gap-2 bg-white rounded border border-green-200 px-3 py-2">
                    <code className="text-sm font-mono flex-1 text-gray-800">{tempPassword}</code>
                    <button onClick={handleCopy} className="text-green-600 hover:text-green-700">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setShowInvite(false); setTempPassword(null); }}
                  className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                >
                  Concluir
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input
                    type="text"
                    required
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    required
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="email@clinica.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Papel</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {ROLES.filter((r) => r.value !== 'OWNER').map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isInviting}
                    className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {isInviting ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

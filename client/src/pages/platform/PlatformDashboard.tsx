import { useEffect, useState } from 'react';
import {
  Building2,
  DollarSign,
  Clock,
  MessageSquare,
  Search,
  Loader2,
  Power,
  PowerOff,
  CheckCircle2,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { platformDataApi } from '../../services/platformApi';
import NewClinicModal from './NewClinicModal';

const PLANS = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const statusStyle: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  SUSPENDED: 'bg-amber-100 text-amber-700',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

const planStyle: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600',
  STARTER: 'bg-sky-100 text-sky-700',
  PRO: 'bg-indigo-100 text-indigo-700',
  ENTERPRISE: 'bg-violet-100 text-violet-700',
};

const toneStyle: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
};

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'indigo',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: keyof typeof toneStyle;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneStyle[tone] || toneStyle.indigo}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function PlatformDashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [orgs, setOrgs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async (searchValue = search) => {
    setLoading(true);
    try {
      const [ov, list] = await Promise.all([
        platformDataApi.overview(),
        platformDataApi.organizations({ search: searchValue || undefined }),
      ]);
      setOverview(ov.data.overview);
      setOrgs(list.data.data);
    } catch {
      toast.error('Erro ao carregar o console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleStatus = async (org: any) => {
    const next = org.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Deseja ${next === 'SUSPENDED' ? 'suspender' : 'reativar'} "${org.name}"?`)) return;
    setBusyId(org.id);
    try {
      await platformDataApi.setStatus(org.id, next);
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, status: next } : o)));
      toast.success(`"${org.name}" ${next === 'SUSPENDED' ? 'suspensa' : 'reativada'}`);
    } catch {
      toast.error('Erro ao alterar status');
    } finally {
      setBusyId(null);
    }
  };

  const changePlan = async (org: any, plan: string) => {
    setBusyId(org.id);
    try {
      await platformDataApi.setPlan(org.id, plan);
      setOrgs((prev) => prev.map((o) => (o.id === org.id ? { ...o, plan } : o)));
      toast.success(`Plano de "${org.name}" alterado para ${plan}`);
    } catch {
      toast.error('Erro ao alterar plano');
    } finally {
      setBusyId(null);
    }
  };

  const o = overview?.organizations;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Visão geral</h1>
          <p className="text-sm text-slate-500">Todas as clínicas da plataforma</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-indigo-600 hover:to-violet-700"
        >
          <Plus className="h-4 w-4" />
          Nova clínica
        </button>
      </div>

      {showNew && (
        <NewClinicModal onClose={() => setShowNew(false)} onCreated={() => load('')} />
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Building2 className="h-4 w-4" />}
          label="Clínicas"
          value={String(o?.total ?? '—')}
          hint={`${o?.active ?? 0} ativas · ${o?.suspended ?? 0} suspensas`}
          tone="indigo"
        />
        <StatCard
          icon={<DollarSign className="h-4 w-4" />}
          label="MRR"
          value={overview ? brl(overview.revenue.mrr) : '—'}
          hint={overview ? `ARR ${brl(overview.revenue.arr)}` : ''}
          tone="emerald"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Trials expirando"
          value={String(overview?.trialsExpiring7d ?? '—')}
          hint="próximos 7 dias"
          tone="amber"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Mensagens no mês"
          value={
            overview
              ? String((overview.usageThisPeriod.messagesIn || 0) + (overview.usageThisPeriod.messagesOut || 0))
              : '—'
          }
          hint={overview?.usageThisPeriod?.period}
          tone="sky"
        />
      </div>

      {/* Tabela de clínicas */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h2 className="text-sm font-semibold text-slate-700">Clínicas</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load();
            }}
            className="relative w-64"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou slug..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
            />
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : orgs.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">Nenhuma clínica encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Clínica</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Usuários</th>
                  <th className="px-4 py-3 font-medium">Pacientes</th>
                  <th className="px-4 py-3 font-medium">MRR</th>
                  <th className="px-4 py-3 font-medium">WhatsApp</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{org.name}</p>
                      <p className="text-xs text-slate-400">/{org.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={org.plan}
                        disabled={busyId === org.id}
                        onChange={(e) => changePlan(org, e.target.value)}
                        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-indigo-300 ${planStyle[org.plan] || 'bg-slate-100 text-slate-600'}`}
                      >
                        {PLANS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[org.status] || 'bg-slate-100 text-slate-600'}`}>
                        {org.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{org._count?.members ?? 0}</td>
                    <td className="px-4 py-3 text-slate-600">{org._count?.patients ?? 0}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{brl(org.mrr)}</td>
                    <td className="px-4 py-3">
                      {org.whatsappStatus === 'CONNECTED' || org.whatsappStatus === 'CONFIGURED' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> ok
                        </span>
                      ) : org.whatsappStatus === 'ERROR' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-rose-600">
                          <AlertTriangle className="h-3.5 w-3.5" /> erro
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleStatus(org)}
                        disabled={busyId === org.id}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                          org.status === 'ACTIVE'
                            ? 'text-amber-700 hover:bg-amber-50'
                            : 'text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {busyId === org.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : org.status === 'ACTIVE' ? (
                          <>
                            <PowerOff className="h-3.5 w-3.5" /> Suspender
                          </>
                        ) : (
                          <>
                            <Power className="h-3.5 w-3.5" /> Reativar
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

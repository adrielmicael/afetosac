import { useEffect, useState } from 'react';
import {
  HeartPulse,
  Loader2,
  Plug,
  PlugZap,
  RefreshCw,
  CheckCircle2,
  Database,
  Users,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { organizationsApi } from '../services/api';

export default function AfetoClinicSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [externalId, setExternalId] = useState('');
  const [savedTenant, setSavedTenant] = useState('');
  const [available, setAvailable] = useState(false);

  const [testResult, setTestResult] = useState<{ columns: string[]; rowCount: number | null } | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await organizationsApi.getAfetoClinic();
      const c = data.afetoClinic;
      setExternalId(c.externalId || '');
      setSavedTenant(c.externalId || '');
      setAvailable(Boolean(c.available));
    } catch {
      toast.error('Erro ao carregar a integração');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await organizationsApi.updateAfetoClinic({ externalId: externalId.trim() });
      setSavedTenant(externalId.trim());
      toast.success('Tenant salvo');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await organizationsApi.testClinicSupabase();
      setTestResult({ columns: data.columns, rowCount: data.rowCount });
      toast.success(`Conexão OK — ${data.rowCount ?? '?'} paciente(s) encontrados`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Falha na conexão');
    } finally {
      setTesting(false);
    }
  };

  const sync = async (dryRun: boolean) => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await organizationsApi.syncClinicPatients({ dryRun });
      setSyncResult({ ...data });
      toast.success(
        dryRun
          ? `Simulação: ${data.eligible} pacientes / ${data.contacts} contatos entrariam`
          : `${data.upserted} pacientes importados em ${data.contacts} contatos`
      );
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const connected = Boolean(savedTenant) && available;

  return (
    <section className="space-y-4 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <HeartPulse className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Afeto Clinic</h3>
            <p className="text-xs text-slate-500">
              Importe os pacientes desta clínica que já estão cadastrados no Afeto Clinic.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            connected ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {connected ? <PlugZap className="h-3.5 w-3.5" /> : <Plug className="h-3.5 w-3.5" />}
          {connected ? 'Conectado' : 'Não configurado'}
        </span>
      </div>

      {!available && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            A integração ainda não foi habilitada pela plataforma. Defina o seu tenant e contate o suporte para liberar o acesso.
          </span>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">
          Identificador da clínica no Afeto Clinic (tenant)
        </label>
        <div className="flex gap-2">
          <input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="ex: afetoespacoterapeuti387"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          <button
            onClick={save}
            disabled={saving || externalId.trim() === savedTenant}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Salvar
          </button>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          É só este código. As credenciais de acesso ao banco são gerenciadas pela plataforma — você não precisa delas.
        </p>
      </div>

      {/* Ações de importação */}
      <div className="flex flex-wrap gap-2 border-t border-rose-100 pt-4">
        <button
          onClick={test}
          disabled={testing || !connected}
          title={!connected ? 'Salve o tenant e aguarde a liberação da plataforma' : ''}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Testar
        </button>
        <button
          onClick={() => sync(true)}
          disabled={syncing || !connected}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Simular importação
        </button>
        <button
          onClick={() => sync(false)}
          disabled={syncing || !connected}
          className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Importar pacientes
        </button>
      </div>

      {testResult && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
          ✅ Conexão OK · {testResult.rowCount ?? '?'} paciente(s) na origem para este tenant.
        </div>
      )}

      {syncResult && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {syncResult.dryRun ? '🧪 Simulação' : '✅ Importação'}: lidos {syncResult.total} ·{' '}
          {syncResult.dryRun ? 'entrariam' : 'importados'} {syncResult.dryRun ? syncResult.eligible : syncResult.upserted}{' '}
          paciente(s) em {syncResult.contacts} contato(s) · {syncResult.skipped} ignorado(s)
        </div>
      )}
    </section>
  );
}

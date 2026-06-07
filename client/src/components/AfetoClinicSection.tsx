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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { organizationsApi } from '../services/api';

export default function AfetoClinicSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [externalId, setExternalId] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState(''); // só preenche para alterar
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [keyMask, setKeyMask] = useState<string | null>(null);

  const [testResult, setTestResult] = useState<{ columns: string[]; rowCount: number | null } | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await organizationsApi.getAfetoClinic();
      const c = data.afetoClinic;
      setEnabled(Boolean(c.enabled));
      setExternalId(c.externalId || '');
      setSupabaseUrl(c.supabaseUrl || '');
      setSupabaseConfigured(Boolean(c.supabaseConfigured));
      setKeyMask(c.supabaseKey || null);
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
      await organizationsApi.updateAfetoClinic({
        enabled,
        externalId: externalId.trim() || undefined,
        supabaseUrl: supabaseUrl.trim() || undefined,
        ...(supabaseKey.trim() ? { supabaseKey: supabaseKey.trim() } : {}),
      });
      toast.success('Integração salva');
      setSupabaseKey('');
      await load();
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
      toast.success('Conexão OK');
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
              Conecte esta clínica ao Afeto Clinic e importe os pacientes.
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            enabled && supabaseConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {enabled && supabaseConfigured ? <PlugZap className="h-3.5 w-3.5" /> : <Plug className="h-3.5 w-3.5" />}
          {enabled && supabaseConfigured ? 'Conectado' : 'Não configurado'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Tenant no Afeto Clinic <span className="text-slate-400">(identifica a clínica)</span>
          </label>
          <input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="ex: afetoespacoterapeuti387"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">URL do Supabase do Clinic</label>
          <input
            value={supabaseUrl}
            onChange={(e) => setSupabaseUrl(e.target.value)}
            placeholder="https://xxxx.supabase.co"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Chave do Supabase (service_role){' '}
            {supabaseConfigured && <span className="text-slate-400">— atual: {keyMask}</span>}
          </label>
          <input
            type="password"
            value={supabaseKey}
            onChange={(e) => setSupabaseKey(e.target.value)}
            placeholder={supabaseConfigured ? 'deixe em branco para manter' : 'cole a service_role key'}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          <p className="mt-1 text-[11px] text-slate-400">Armazenada cifrada (AES-256-GCM). Nunca é exibida em texto.</p>
        </div>

        <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <span className="text-sm text-slate-700">Integração ativa</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-rose-100 pt-4">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Salvar
        </button>
        <button
          onClick={test}
          disabled={testing || !supabaseConfigured}
          title={!supabaseConfigured ? 'Salve a URL e a chave primeiro' : ''}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          Testar conexão
        </button>
        <button
          onClick={() => sync(true)}
          disabled={syncing || !supabaseConfigured}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Simular importação
        </button>
        <button
          onClick={() => sync(false)}
          disabled={syncing || !supabaseConfigured}
          className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          Importar pacientes
        </button>
      </div>

      {/* Resultado do teste */}
      {testResult && (
        <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <p className="font-semibold text-slate-700">
            Conexão OK · {testResult.rowCount ?? '?'} registro(s) na origem
          </p>
          <p className="mt-1 text-slate-500">
            Colunas detectadas: {testResult.columns.slice(0, 12).join(', ')}
            {testResult.columns.length > 12 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Resultado do sync */}
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

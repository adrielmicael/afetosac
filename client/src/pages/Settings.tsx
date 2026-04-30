import { useState, useEffect } from 'react';
import { useAuthStore } from '../store';
import {
  User,
  Bell,
  Shield,
  Users,
  MessageSquare,
  Palette,
  Plug,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Globe,
  Key,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  failureCount: number;
  lastDeliveryAt: string | null;
  lastStatus: string | null;
  createdAt: string;
}

const AVAILABLE_PERMISSIONS = [
  { value: 'read_chats', label: 'Ler atendimentos' },
  { value: 'write_chats', label: 'Criar/atualizar atendimentos' },
  { value: 'read_messages', label: 'Ler mensagens' },
  { value: 'write_messages', label: 'Enviar mensagens' },
  { value: 'read_patients', label: 'Ler pacientes' },
  { value: 'write_patients', label: 'Criar/atualizar pacientes' },
  { value: 'read_dashboard', label: 'Acessar dashboard' },
];

const AVAILABLE_EVENTS = [
  { value: '*', label: 'Todos os eventos' },
  { value: 'chat.created', label: 'Atendimento criado' },
  { value: 'chat.closed', label: 'Atendimento encerrado' },
  { value: 'chat.assigned', label: 'Atendimento atribuído' },
  { value: 'message.received', label: 'Mensagem recebida' },
  { value: 'message.sent', label: 'Mensagem enviada' },
  { value: 'patient.created', label: 'Paciente criado' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-slate-400 hover:text-slate-600 transition-colors" title="Copiar">
      {copied ? <Check className="w-4 h-4 text-teal-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function RevealText({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-flex items-center gap-2 font-mono text-sm">
      {show ? text : '••••••••••••••••••••'}
      <button onClick={() => setShow((v) => !v)} className="text-slate-400 hover:text-slate-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <CopyButton text={text} />
    </span>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

function IntegrationsTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingWebhooks, setLoadingWebhooks] = useState(true);

  // Modal state — API Key
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState<string[]>(['read_chats', 'read_messages']);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);

  // Modal state — Webhook
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookDesc, setNewWebhookDesc] = useState('');
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(['chat.created', 'message.received']);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchKeys = async () => {
    setLoadingKeys(true);
    try {
      const res = await api.get('/api-keys');
      setApiKeys(res.data.data);
    } catch {
      toast.error('Erro ao carregar chaves de API');
    } finally {
      setLoadingKeys(false);
    }
  };

  const fetchWebhooks = async () => {
    setLoadingWebhooks(true);
    try {
      const res = await api.get('/webhook-endpoints');
      setWebhooks(res.data.data);
    } catch {
      toast.error('Erro ao carregar endpoints');
    } finally {
      setLoadingWebhooks(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchWebhooks();
  }, []);

  const togglePerm = (p: string) => {
    setNewKeyPerms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const toggleEvent = (e: string) => {
    if (e === '*') {
      setNewWebhookEvents(['*']);
      return;
    }
    setNewWebhookEvents((prev) => {
      const without = prev.filter((x) => x !== '*');
      return without.includes(e) ? without.filter((x) => x !== e) : [...without, e];
    });
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) { toast.error('Informe um nome'); return; }
    if (newKeyPerms.length === 0) { toast.error('Selecione ao menos uma permissão'); return; }
    setSavingKey(true);
    try {
      const res = await api.post('/api-keys', { name: newKeyName, permissions: newKeyPerms });
      setCreatedKey(res.data.data.fullKey);
      await fetchKeys();
      setNewKeyName('');
      setNewKeyPerms(['read_chats', 'read_messages']);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar chave');
    } finally {
      setSavingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm('Revogar esta chave? Integrações que usam ela vão parar de funcionar.')) return;
    try {
      await api.delete(`/api-keys/${id}`);
      toast.success('Chave revogada');
      await fetchKeys();
    } catch {
      toast.error('Erro ao revogar chave');
    }
  };

  const handleCreateWebhook = async () => {
    if (!newWebhookUrl.trim()) { toast.error('Informe a URL'); return; }
    if (newWebhookEvents.length === 0) { toast.error('Selecione ao menos um evento'); return; }
    setSavingWebhook(true);
    try {
      const res = await api.post('/webhook-endpoints', {
        url: newWebhookUrl,
        description: newWebhookDesc,
        events: newWebhookEvents,
      });
      setCreatedWebhookSecret(res.data.data.secret);
      await fetchWebhooks();
      setNewWebhookUrl('');
      setNewWebhookDesc('');
      setNewWebhookEvents(['chat.created', 'message.received']);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar endpoint');
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm('Remover este endpoint?')) return;
    try {
      await api.delete(`/webhook-endpoints/${id}`);
      toast.success('Endpoint removido');
      await fetchWebhooks();
    } catch {
      toast.error('Erro ao remover endpoint');
    }
  };

  const handleTestWebhook = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.post(`/webhook-endpoints/${id}/test`);
      if (res.data.success) {
        toast.success(`Teste bem-sucedido (${res.data.status})`);
      } else {
        toast.error(`Falhou: ${res.data.message}`);
      }
    } catch {
      toast.error('Erro ao testar endpoint');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrações &amp; API</h2>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie chaves de API e endpoints de webhook para integrar sistemas externos.
        </p>
      </div>

      {/* ── API Keys ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800">Chaves de API</h3>
          </div>
          <button
            onClick={() => { setShowKeyForm(true); setCreatedKey(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nova chave
          </button>
        </div>

        {/* Alerta de chave criada */}
        {createdKey && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Guarde esta chave agora!</p>
                <p className="text-xs text-amber-700 mt-0.5 mb-2">Ela não será exibida novamente.</p>
                <RevealText text={createdKey} />
              </div>
            </div>
          </div>
        )}

        {/* Formulário inline */}
        {showKeyForm && !createdKey && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <h4 className="font-semibold text-slate-700 text-sm">Nova chave de API</h4>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nome</label>
              <input
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Ex: Integração HIS"
                className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Permissões</label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_PERMISSIONS.map((p) => (
                  <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newKeyPerms.includes(p.value)}
                      onChange={() => togglePerm(p.value)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700">{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateKey}
                disabled={savingKey}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar
              </button>
              <button
                onClick={() => setShowKeyForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loadingKeys ? (
          <div className="py-6 text-center text-slate-400 text-sm">Carregando...</div>
        ) : apiKeys.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Nenhuma chave criada ainda.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between px-4 py-3 bg-white">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{k.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{k.keyPrefix}••••••••</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {k.permissions.join(', ')}
                    {k.lastUsedAt && ` · Último uso: ${new Date(k.lastUsedAt).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${k.isActive ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
                    {k.isActive ? 'Ativa' : 'Revogada'}
                  </span>
                  {k.isActive && (
                    <button
                      onClick={() => handleRevokeKey(k.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="Revogar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Use <code className="bg-white border border-slate-200 px-1 rounded font-mono">Authorization: Bearer sk_live_...</code> para autenticar chamadas à API.
        </div>
      </section>

      {/* ── Webhook Endpoints ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-800">Endpoints de Webhook</h3>
          </div>
          <button
            onClick={() => { setShowWebhookForm(true); setCreatedWebhookSecret(null); }}
            className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo endpoint
          </button>
        </div>

        {/* Alerta de segredo criado */}
        {createdWebhookSecret && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Guarde o segredo HMAC agora!</p>
                <p className="text-xs text-amber-700 mt-0.5 mb-2">Ele não será exibido novamente. Use para validar a assinatura <code>X-Afeto-Signature</code>.</p>
                <RevealText text={createdWebhookSecret} />
              </div>
            </div>
          </div>
        )}

        {/* Formulário inline */}
        {showWebhookForm && !createdWebhookSecret && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <h4 className="font-semibold text-slate-700 text-sm">Novo endpoint de webhook</h4>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">URL (HTTPS obrigatório)</label>
              <input
                value={newWebhookUrl}
                onChange={(e) => setNewWebhookUrl(e.target.value)}
                placeholder="https://meu-sistema.com/webhooks/afeto"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descrição (opcional)</label>
              <input
                value={newWebhookDesc}
                onChange={(e) => setNewWebhookDesc(e.target.value)}
                placeholder="Ex: Notificação para sistema legado"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Eventos</label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWebhookEvents.includes(ev.value)}
                      onChange={() => toggleEvent(ev.value)}
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700">{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCreateWebhook}
                disabled={savingWebhook}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
              >
                {savingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Criar
              </button>
              <button
                onClick={() => setShowWebhookForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loadingWebhooks ? (
          <div className="py-6 text-center text-slate-400 text-sm">Carregando...</div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">Nenhum endpoint configurado.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
            {webhooks.map((wh) => (
              <div key={wh.id} className="px-4 py-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{wh.url}</p>
                    {wh.description && <p className="text-xs text-slate-500 mt-0.5">{wh.description}</p>}
                    <p className="text-xs text-slate-400 mt-1">{wh.events.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {wh.lastStatus && (
                      <span className={`flex items-center gap-1 text-xs font-medium ${wh.lastStatus === '200' ? 'text-teal-600' : 'text-red-500'}`}>
                        {wh.lastStatus === '200'
                          ? <CheckCircle2 className="w-3.5 h-3.5" />
                          : <AlertCircle className="w-3.5 h-3.5" />}
                        {wh.lastStatus}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${wh.isActive ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-600'}`}>
                      {wh.isActive ? 'Ativo' : 'Desativado'}
                    </span>
                    <button
                      onClick={() => handleTestWebhook(wh.id)}
                      disabled={testingId === wh.id}
                      className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60 transition-colors"
                    >
                      {testingId === wh.id ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : 'Testar'}
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(wh.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {wh.failureCount > 0 && (
                  <p className="text-xs text-red-500 mt-1">⚠ {wh.failureCount} falha(s) consecutivas</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          Afeto SAC envia um <code className="bg-white border border-slate-200 px-1 rounded font-mono">POST</code> com header <code className="bg-white border border-slate-200 px-1 rounded font-mono">X-Afeto-Signature: sha256=...</code>. Valide com HMAC-SHA256 usando o segredo.
        </div>
      </section>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Settings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', name: 'Perfil', icon: User },
    { id: 'notifications', name: 'Notificações', icon: Bell },
    { id: 'security', name: 'Segurança', icon: Shield },
    { id: 'team', name: 'Equipe', icon: Users },
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare },
    { id: 'integrations', name: 'Integrações', icon: Plug },
    { id: 'appearance', name: 'Aparência', icon: Palette },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 bg-white rounded-xl shadow-sm p-4">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Informações do Perfil</h2>
              
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-2xl font-medium text-primary-700">
                    {user?.name?.charAt(0)}
                  </span>
                </div>
                <button className="px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
                  Alterar Foto
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.name}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  Salvar Alterações
                </button>
              </div>
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Configuração do WhatsApp</h2>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  Configure as credenciais da API do WhatsApp Business para enviar e receber mensagens.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Access Token
                  </label>
                  <input
                    type="password"
                    placeholder="EAAB..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    placeholder="1234567890"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Webhook Verify Token
                  </label>
                  <input
                    type="text"
                    placeholder="seu_token_aqui"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  Salvar Configurações
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Alterar Senha</h2>

              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                  Alterar Senha
                </button>
              </div>
            </div>
          )}

          {activeTab === 'integrations' && <IntegrationsTab />}

          {['notifications', 'team', 'appearance'].includes(activeTab) && (
            <div className="text-center py-12 text-gray-500">
              Funcionalidade em desenvolvimento
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

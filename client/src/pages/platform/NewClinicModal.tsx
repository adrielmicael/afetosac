import { useState } from 'react';
import { X, Loader2, Building2, Mail, UserRound, KeyRound, Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { platformDataApi } from '../../services/platformApi';

interface NewClinicModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function NewClinicModal({ onClose, onCreated }: NewClinicModalProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [externalId, setExternalId] = useState('');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [created, setCreated] = useState<{
    name: string;
    slug: string;
    email: string;
    tempPassword?: string;
  } | null>(null);

  const effectiveSlug = slug || slugify(name);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !userEmail || !userName) return;
    setLoading(true);
    try {
      const { data } = await platformDataApi.createOrganization({
        name,
        slug: effectiveSlug || undefined,
        userEmail,
        userName,
        userPassword: userPassword || undefined,
        externalId: externalId.trim() || undefined,
      });
      setCreated({
        name: data.organization.name,
        slug: data.organization.slug,
        email: data.owner.email,
        tempPassword: data.tempPassword,
      });
      onCreated();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao criar clínica');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success('Copiado');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Building2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-slate-800">
              {created ? 'Clínica criada' : 'Cadastrar clínica'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {created ? (
          /* Estado de sucesso — credenciais do responsável */
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>
                <strong>{created.name}</strong> criada com sucesso (/{created.slug}).
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Acesso do responsável
              </p>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">E-mail</span>
                  <button
                    onClick={() => copy(created.email)}
                    className="inline-flex items-center gap-1 font-medium text-slate-800 hover:text-indigo-600"
                  >
                    {created.email} <Copy className="h-3 w-3" />
                  </button>
                </div>
                {created.tempPassword && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500">Senha temporária</span>
                    <button
                      onClick={() => copy(created.tempPassword!)}
                      className="inline-flex items-center gap-1 font-mono font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {created.tempPassword} <Copy className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {created.tempPassword && (
                <p className="mt-3 text-[11px] leading-relaxed text-amber-600">
                  ⚠️ Anote agora — esta senha só é exibida uma vez. Oriente o responsável a trocá-la no primeiro acesso.
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Concluir
            </button>
          </div>
        ) : (
          /* Formulário */
          <form onSubmit={submit} className="space-y-4 p-5">
            <Field label="Nome da clínica" icon={<Building2 className="h-4 w-4" />}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Clínica Exemplo"
                className={inputCls}
                autoFocus
              />
            </Field>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Slug (URL) <span className="text-slate-400">— opcional</span>
              </label>
              <div className="flex items-center rounded-lg border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20">
                <span className="pl-3 text-sm text-slate-400">/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder={slugify(name) || 'clinica-exemplo'}
                  className="w-full bg-transparent px-2 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Tenant Afeto Clinic <span className="text-slate-400">— opcional</span>
              </label>
              <input
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="ex: afetoespacoterapeuti387"
                className={inputCls}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Vincula a clínica aos pacientes dela no Afeto Clinic (pode definir depois).
              </p>
            </div>

            <div className="h-px bg-slate-100" />
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Responsável (OWNER)</p>

            <Field label="Nome do responsável" icon={<UserRound className="h-4 w-4" />}>
              <input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Maria Silva" className={inputCls} />
            </Field>

            <Field label="E-mail" icon={<Mail className="h-4 w-4" />}>
              <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="maria@clinica.com" className={inputCls} />
            </Field>

            <Field label="Senha (em branco = gerar automaticamente)" icon={<KeyRound className="h-4 w-4" />}>
              <input type="text" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="deixe em branco para gerar" className={inputCls} />
            </Field>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !name || !userEmail || !userName}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-2.5 text-sm font-semibold text-white transition hover:from-indigo-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar clínica'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20';

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}

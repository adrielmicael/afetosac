import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldHalf, Lock, Mail, Loader2, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { platformAuthApi } from '../../services/platformApi';
import { usePlatformStore } from '../../store/platform';

export default function PlatformLogin() {
  const navigate = useNavigate();
  const { setAuth } = usePlatformStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const finish = (admin: any, token: string) => {
    setAuth(admin, token);
    toast.success('Bem-vindo ao Console SaaS');
    navigate('/platform');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await platformAuthApi.login({ email, password });
      if (data.requires2FA && data.challengeToken) {
        setChallengeToken(data.challengeToken);
        toast('Informe o código do autenticador', { icon: '🔐' });
        return;
      }
      if (data.token && data.admin) finish(data.admin, data.token);
      if (data.mustEnable2FA) {
        toast('Habilite o 2FA o quanto antes (segurança da plataforma).', { icon: '⚠️', duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    setLoading(true);
    try {
      const { data } = await platformAuthApi.verify2FA({ challengeToken, token: code.trim() });
      if (data.token && data.admin) finish(data.admin, data.token);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setChallengeToken(null);
        setCode('');
        toast.error('Verificação expirou. Entre novamente.');
      } else {
        toast.error(err.response?.data?.error || 'Código inválido');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-900/40">
            <ShieldHalf className="h-6 w-6 text-white" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white">Afeto SaaS · Console</h1>
          <p className="mt-1 text-sm text-slate-400">Administração da plataforma</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">
          {!challengeToken ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">E-mail</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="admin@afeto.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">Senha</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:from-indigo-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Entrar no console'}
              </button>
            </form>
          ) : (
            <form onSubmit={onVerify} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Código de verificação (2FA)
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2.5 pl-10 pr-3 text-sm tracking-widest text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    placeholder="000000"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 transition hover:from-indigo-600 hover:to-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verificar'}
              </button>
              <button
                type="button"
                onClick={() => { setChallengeToken(null); setCode(''); }}
                className="w-full text-center text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Voltar
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Acesso restrito a operadores da plataforma.
        </p>
      </div>
    </div>
  );
}

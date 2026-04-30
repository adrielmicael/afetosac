import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Heart, Loader2, Lock, Mail, MessageCircle, ShieldCheck, Users } from 'lucide-react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const fillDemoCredentials = () => {
    setValue('email', 'admin@afeto.com');
    setValue('password', 'admin123');
    toast.success('Credenciais de demonstração preenchidas');
  };

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      const { user, token } = response.data;
      setAuth(user, token);
      toast.success('Bem-vindo ao Afeto SAC!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erro ao fazer login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-emerald-50 via-cyan-50 to-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-cyan-300/30 blur-3xl" />
      </div>
      {/* Painel esquerdo — formulário */}
      <div className="relative flex w-full flex-col justify-center px-6 py-10 sm:px-10 md:w-[480px] md:px-12 lg:w-[520px]">
        <div className="rounded-3xl border border-emerald-100 bg-white/95 p-7 shadow-2xl backdrop-blur-sm sm:p-8">
        {/* Logo */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
              <MessageCircle className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Afeto SAC</span>
          </div>
        </div>

        {/* Cabeçalho */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-slate-900">Faça login na sua conta</h1>
          <p className="mt-1 text-sm text-slate-500">Acesse o painel de atendimento</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">E-mail</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                {...register('email')}
                autoComplete="email"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 placeholder:text-slate-400"
                placeholder="seu@email.com"
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">Senha</label>
              <a href="#" className="text-xs font-medium text-teal-600 hover:text-teal-700">
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-11 text-sm text-slate-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 placeholder:text-slate-400"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-400/20 transition hover:from-emerald-700 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'ACESSAR'
            )}
          </button>
        </form>

        {/* Demo */}
        <div className="mt-6 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Demonstração
            </p>
            <button
              type="button"
              onClick={fillDemoCredentials}
              className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
            >
              Preencher
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            admin@afeto.com &nbsp;/&nbsp; admin123
          </p>
        </div>
        </div>
      </div>

      {/* Painel direito — branding */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-teal-900 via-teal-800 to-slate-900 p-14 text-white md:flex">
        {/* Decoração de fundo */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        </div>

        {/* Conteúdo principal */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
            Clínicas &amp; ABA
          </div>

          <h2 className="mt-8 max-w-sm text-4xl font-extrabold leading-tight">
            Atendimento humanizado com controle clínico total
          </h2>

          <p className="mt-4 max-w-sm text-sm leading-relaxed text-teal-100/80">
            Centralize chats do WhatsApp, gerencie equipes multidisciplinares e mantenha rastreabilidade completa para compliance LGPD.
          </p>
        </div>

        {/* Cards de features */}
        <div className="relative space-y-3">
          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <ShieldCheck className="h-4 w-4 text-teal-300" />
            </div>
            <div>
              <p className="text-sm font-semibold">Conformidade LGPD</p>
              <p className="text-xs text-teal-100/70">Dados clínicos isolados por organização</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Users className="h-4 w-4 text-cyan-300" />
            </div>
            <div>
              <p className="text-sm font-semibold">Equipes multidisciplinares</p>
              <p className="text-xs text-teal-100/70">Terapeutas, recepcionistas e gestores</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Heart className="h-4 w-4 text-rose-300" />
            </div>
            <div>
              <p className="text-sm font-semibold">Continuidade terapêutica</p>
              <p className="text-xs text-teal-100/70">Histórico completo de atendimentos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

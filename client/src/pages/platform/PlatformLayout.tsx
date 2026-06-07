import { Outlet, useNavigate } from 'react-router-dom';
import { ShieldHalf, LogOut } from 'lucide-react';
import { usePlatformStore } from '../../store/platform';
import { platformAuthApi } from '../../services/platformApi';

export default function PlatformLayout() {
  const navigate = useNavigate();
  const { admin, logout } = usePlatformStore();

  const handleLogout = async () => {
    try {
      await platformAuthApi.logout();
    } catch {
      /* segue com logout local */
    } finally {
      logout();
      navigate('/platform/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar do console */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <ShieldHalf className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Afeto SaaS · Console</p>
              <p className="text-[11px] text-slate-400">Administração da plataforma</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium">{admin?.name}</p>
              <p className="text-[11px] text-indigo-300">{admin?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

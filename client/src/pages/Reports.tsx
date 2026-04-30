import { useEffect, useState } from 'react';
import {
  BarChart2,
  TrendingUp,
  MessageSquare,
  CheckCircle,
  Clock,
  Users,
  Download,
  ChevronDown,
} from 'lucide-react';
import { dashboardApi } from '../services/api';
import toast from 'react-hot-toast';

type Period = '7d' | '30d' | '90d' | 'custom';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'custom', label: 'Período personalizado' },
];

function periodToDates(period: Period): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  if (period === '7d') start.setDate(end.getDate() - 7);
  else if (period === '30d') start.setDate(end.getDate() - 30);
  else if (period === '90d') start.setDate(end.getDate() - 90);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async (p: Period, cs?: string, ce?: string) => {
    setIsLoading(true);
    try {
      const dates =
        p === 'custom' && cs && ce
          ? { startDate: cs, endDate: ce }
          : periodToDates(p);
      const res = await dashboardApi.getReports(dates);
      setReport(res.data);
    } catch {
      toast.error('Erro ao carregar relatórios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (period !== 'custom') load(period);
  }, [period]);

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return toast.error('Selecione as datas');
    load('custom', customStart, customEnd);
  };

  const handleExportCSV = () => {
    if (!report) return;
    const rows = [
      ['Data', 'Conversas'],
      ...report.chatsByDay.map((d: any) => [d.day, d.count]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxDay = Math.max(...(report?.chatsByDay?.map((d: any) => d.count) ?? [1]), 1);
  const maxAgent = Math.max(...(report?.agentPerformance?.map((a: any) => a.handled) ?? [1]), 1);

  const summaryCards = report
    ? [
        { label: 'Conversas no período', value: report.summary.totalChats, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Finalizadas', value: report.summary.closedChats, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Taxa de resolução', value: `${report.summary.resolutionRate}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Total de mensagens', value: report.summary.totalMessages, icon: BarChart2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: '1ª resposta (min)', value: report.summary.avgFirstResponseMinutes, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          {report && (
            <p className="text-sm text-gray-500 mt-1">
              {new Date(report.period.start).toLocaleDateString('pt-BR')} —{' '}
              {new Date(report.period.end).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Seletor de período */}
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="appearance-none pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          {period === 'custom' && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-gray-400 text-sm">até</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleCustomApply}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors"
              >
                Aplicar
              </button>
            </>
          )}
          <button
            onClick={handleExportCSV}
            disabled={!report}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Carregando relatório...</div>
      ) : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {summaryCards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="bg-white rounded-xl shadow-sm p-5">
                  <div className={`inline-flex p-2 rounded-lg ${c.bg} mb-3`}>
                    <Icon className={`w-4 h-4 ${c.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{c.label}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de conversas por dia */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Conversas por Dia</h2>
              {report.chatsByDay.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sem dados no período</div>
              ) : (
                <div className="flex items-end gap-1 h-40 overflow-x-auto">
                  {report.chatsByDay.map((d: any) => (
                    <div key={d.day} className="flex flex-col items-center gap-1 flex-1 min-w-[20px]">
                      <span className="text-xs text-gray-500 whitespace-nowrap">{d.count}</span>
                      <div
                        className="w-full bg-primary-500 rounded-t transition-all hover:bg-primary-600"
                        style={{ height: `${Math.max((d.count / maxDay) * 120, 4)}px` }}
                        title={`${d.day}: ${d.count}`}
                      />
                      <span className="text-[10px] text-gray-400 whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '40px' }}>
                        {new Date(d.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Performance por agente */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Performance por Agente</h2>
              {report.agentPerformance.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sem dados</div>
              ) : (
                <div className="space-y-4">
                  {report.agentPerformance.map((a: any) => (
                    <div key={a.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-primary-700">
                              {a.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm text-gray-700 truncate max-w-[140px]">{a.name}</span>
                        </div>
                        <div className="text-xs text-gray-500 shrink-0 ml-2">
                          {a.handled} atend. · {a.closed} fechados
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-400 rounded-full"
                          style={{ width: `${(a.handled / maxAgent) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pacientes mais atendidos */}
          {report.topPatients.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" /> Pacientes com Mais Atendimentos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {report.topPatients.map((p: any, i: number) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg font-bold text-gray-300">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.chats} atendimento{p.chats !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

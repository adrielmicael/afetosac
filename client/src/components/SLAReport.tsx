import { useEffect, useState } from 'react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { slaApi } from '../services/api';
import { Clock, CheckCircle, Users } from 'lucide-react';

export function SLAReport() {
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const response = await slaApi.getReport({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setReport(response.data.report);
    } catch (error) {
      console.error('Error fetching SLA report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Carregando relatório...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-12 text-gray-500">
        Configure o SLA para ver relatórios
      </div>
    );
  }

  const COLORS = ['#10b981', '#ef4444'];

  const firstResponseData = [
    { name: 'Dentro do SLA', value: report.firstResponse.withinSLA },
    { name: 'Fora do SLA', value: report.firstResponse.breached },
  ];

  const resolutionData = [
    { name: 'Dentro do SLA', value: report.resolution.withinSLA },
    { name: 'Fora do SLA', value: report.resolution.breached },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Relatório de SLA</h2>
        
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          />
          <span className="self-center">até</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Clock className="w-5 h-5" />
            <span>Total de Chats</span>
          </div>
          <div className="text-2xl font-bold">{report.summary.totalChats}</div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span>Taxa SLA Primeira Resposta</span>
          </div>
          <div className="text-2xl font-bold text-green-600">
            {report.firstResponse.slaRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            Meta: {report.firstResponse.target} min
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span>Taxa SLA Resolução</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {report.resolution.slaRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">
            Meta: {Math.round(report.resolution.target / 60)}h
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Users className="w-5 h-5" />
            <span>Média Primeira Resposta</span>
          </div>
          <div className="text-2xl font-bold">
            {report.firstResponse.avgTimeMinutes} min
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="font-semibold mb-4">Primeira Resposta</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={firstResponseData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {firstResponseData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm">Dentro ({report.firstResponse.withinSLA})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm">Fora ({report.firstResponse.breached})</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="font-semibold mb-4">Resolução</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={resolutionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {resolutionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-sm">Dentro ({report.resolution.withinSLA})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-sm">Fora ({report.resolution.breached})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ranking de Agentes */}
      {report.agentRanking?.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="font-semibold mb-4">Ranking de Agentes</h3>
          <div className="space-y-3">
            {report.agentRanking.map((agent: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center font-semibold text-primary-700">
                    {index + 1}
                  </div>
                  <span className="font-medium">{agent.name}</span>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Chats</div>
                    <div className="font-medium">{agent.chats}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Taxa SLA</div>
                    <div className={`font-medium ${agent.slaRate >= 90 ? 'text-green-600' : agent.slaRate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {agent.slaRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Tempo Médio</div>
                    <div className="font-medium">{Math.round(agent.avgFirstResponseTime)} min</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SLAReport;

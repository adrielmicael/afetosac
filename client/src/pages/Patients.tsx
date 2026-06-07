import { useEffect, useState } from 'react';
import {
  Search,
  Plus,
  Phone,
  Mail,
  User,
  X,
  Stethoscope,
  Heart,
  Edit2,
  MessageSquare,
} from 'lucide-react';
import { patientsApi } from '../services/api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  name: '',
  age: '',
  phone: '',
  email: '',
  responsible: '',
  diagnosis: '',
  therapist: '',
  healthPlan: '',
  notes: '',
};

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    const timer = setTimeout(fetchPatients, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPatients = async () => {
    setIsLoading(true);
    try {
      const response = await patientsApi.getAll({ search: searchTerm || undefined });
      setPatients(response.data.patients);
    } catch {
      toast.error('Erro ao carregar pacientes');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingPatient(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (patient: any) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name ?? '',
      age: patient.age ?? '',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      responsible: patient.responsible ?? '',
      diagnosis: patient.diagnosis ?? '',
      therapist: patient.therapist ?? '',
      healthPlan: patient.healthPlan ?? '',
      notes: patient.notes ?? '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPatient) {
        await patientsApi.update(editingPatient.id, formData);
        toast.success('Paciente atualizado!');
      } else {
        await patientsApi.create(formData);
        toast.success('Paciente criado!');
      }
      setShowModal(false);
      fetchPatients();
    } catch {
      toast.error('Erro ao salvar paciente');
    }
  };

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-1">{patients.length} paciente{patients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Novo Paciente
        </button>
      </div>

      {/* Busca */}
      <div className="bg-white p-4 rounded-xl shadow-sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Grid de pacientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-gray-400">Carregando...</div>
        ) : patients.length === 0 ? (
          <div className="col-span-full py-16 text-center text-gray-400">
            {searchTerm ? 'Nenhum paciente encontrado para a busca' : 'Nenhum paciente cadastrado ainda'}
          </div>
        ) : (
          patients.map((patient) => (
            <div key={patient.id} className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-primary-700 font-semibold">{patient.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{patient.name}</h3>
                    {patient.age && <p className="text-xs text-gray-400">{patient.age} anos</p>}
                  </div>
                </div>
                <button
                  onClick={() => openEdit(patient)}
                  className="text-gray-400 hover:text-primary-600 transition-colors p-1"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 flex-1">
                {patient.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{patient.phone}</span>
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{patient.email}</span>
                  </div>
                )}
                {patient.responsible && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">Resp: {patient.responsible}</span>
                  </div>
                )}
                {patient.diagnosis && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Stethoscope className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{patient.diagnosis}</span>
                  </div>
                )}
                {patient.healthPlan && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Heart className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{patient.healthPlan}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100">
                <Link
                  to={`/chats?patient=${patient.id}`}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Ver Atendimentos
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal criar/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dados Pessoais</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input required type="text" value={formData.name} onChange={f('name')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idade</label>
                  <input type="text" value={formData.age} onChange={f('age')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                  <input required type="tel" value={formData.phone} onChange={f('phone')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input type="email" value={formData.email} onChange={f('email')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                  <input type="text" value={formData.responsible} onChange={f('responsible')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>

              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Dados Clínicos</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnóstico</label>
                  <input type="text" value={formData.diagnosis} onChange={f('diagnosis')}
                    placeholder="Ex: TEA, TDAH..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terapeuta</label>
                  <input type="text" value={formData.therapist} onChange={f('therapist')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plano de Saúde</label>
                  <input type="text" value={formData.healthPlan} onChange={f('healthPlan')}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea value={formData.notes} onChange={f('notes')} rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit"
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors">
                  {editingPatient ? 'Salvar Alterações' : 'Criar Paciente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



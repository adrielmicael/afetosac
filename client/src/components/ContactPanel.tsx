import { useState } from 'react';
import { Phone, Users, Check, Stethoscope, UserRound, Loader2, ChevronRight } from 'lucide-react';
import type { Contact, Patient } from '../types';

interface ContactPanelProps {
  contact?: Contact | null;
  activePatientId?: string | null;
  onSelectPatient: (patientId: string) => Promise<void> | void;
}

const initials = (name?: string) =>
  (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

function PatientCard({
  patient,
  active,
  busy,
  onSelect,
}: {
  patient: Patient;
  active: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={busy || active}
      className={`group w-full rounded-2xl border p-3 text-left transition-all ${
        active
          ? 'border-primary-300 bg-primary-50/70 shadow-sm ring-1 ring-primary-200'
          : 'border-slate-200 bg-white hover:border-primary-200 hover:bg-primary-50/30 hover:shadow-sm'
      } ${busy ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            active ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-700'
          }`}
        >
          {initials(patient.name)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-800">{patient.name}</p>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                <Check className="h-3 w-3" /> Ativo
              </span>
            ) : busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-primary-500" />
            )}
          </div>

          {patient.age && <p className="mt-0.5 text-xs text-slate-500">{patient.age}</p>}

          {patient.therapies && patient.therapies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {patient.therapies.slice(0, 4).map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: `${t.color}1a`, color: t.color }}
                >
                  <Stethoscope className="h-2.5 w-2.5" />
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ContactPanel({ contact, activePatientId, onSelectPatient }: ContactPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSelect = async (patientId: string) => {
    setBusyId(patientId);
    try {
      await onSelectPatient(patientId);
    } finally {
      setBusyId(null);
    }
  };

  const patients = contact?.patients ?? [];

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-slate-200 bg-slate-50/60 lg:flex">
      {/* Cabeçalho do contato */}
      <div className="border-b border-slate-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-bold text-white shadow-sm">
            {initials(contact?.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {contact?.name || 'Contato'}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <Phone className="h-3 w-3" />
              {contact?.phone || '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Lista de pacientes */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Users className="h-3.5 w-3.5" />
            Pacientes
          </div>
          {patients.length > 0 && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {patients.length}
            </span>
          )}
        </div>

        {patients.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-center">
            <UserRound className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-medium text-slate-500">
              Nenhum paciente vinculado a este número
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              Sincronize com o Afeto Clinic ou cadastre um paciente.
            </p>
          </div>
        ) : (
          <>
            {patients.length > 1 && (
              <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
                Este número tem mais de um paciente. Escolha de qual é o atendimento:
              </p>
            )}
            <div className="space-y-2">
              {patients.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  active={p.id === activePatientId}
                  busy={busyId === p.id}
                  onSelect={() => handleSelect(p.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

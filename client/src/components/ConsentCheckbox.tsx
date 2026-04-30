/**
 * Componente de Consentimento LGPD
 * Exibe checkbox de consentimento no cadastro
 */

import { useState } from 'react';
import { Shield, FileText, Mail } from 'lucide-react';

interface ConsentCheckboxProps {
  onConsentChange: (consents: { marketing: boolean; treatment: boolean; dataProcessing: boolean }) => void;
  privacyVersion: string;
}

export function ConsentCheckbox({ onConsentChange, privacyVersion }: ConsentCheckboxProps) {
  const [consents, setConsents] = useState({
    marketing: false,
    treatment: true, // Pré-selecionado (necessário para atendimento)
    dataProcessing: true, // Pré-selecionado (necessário para atendimento)
  });

  const handleChange = (key: keyof typeof consents) => {
    const newConsents = { ...consents, [key]: !consents[key] };
    setConsents(newConsents);
    onConsentChange(newConsents);
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-primary-600" />
        <h3 className="font-semibold text-gray-900">Consentimento de Dados (LGPD)</h3>
      </div>

      {/* Consentimento de Tratamento */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="consent-treatment"
          checked={consents.treatment}
          onChange={() => handleChange('treatment')}
          className="mt-1 w-4 h-4 text-primary-600 rounded border-gray-300"
          required
        />
        <label htmlFor="consent-treatment" className="text-sm text-gray-700">
          <span className="font-medium">Tratamento de dados para atendimento *</span>
          <p className="text-gray-500 text-xs mt-1">
            Concordo com o processamento dos meus dados pessoais para fins de atendimento médico e agendamento de consultas.
          </p>
        </label>
      </div>

      {/* Consentimento de Processamento */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="consent-processing"
          checked={consents.dataProcessing}
          onChange={() => handleChange('dataProcessing')}
          className="mt-1 w-4 h-4 text-primary-600 rounded border-gray-300"
          required
        />
        <label htmlFor="consent-processing" className="text-sm text-gray-700">
          <span className="font-medium">Processamento de dados *</span>
          <p className="text-gray-500 text-xs mt-1">
            Concordo com o armazenamento e processamento dos meus dados conforme descrito na{' '}
            <a href="/privacy" target="_blank" className="text-primary-600 underline">
              Política de Privacidade
            </a>.
          </p>
        </label>
      </div>

      {/* Consentimento de Marketing */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="consent-marketing"
          checked={consents.marketing}
          onChange={() => handleChange('marketing')}
          className="mt-1 w-4 h-4 text-primary-600 rounded border-gray-300"
        />
        <label htmlFor="consent-marketing" className="text-sm text-gray-700">
          <span className="font-medium">Marketing (opcional)</span>
          <p className="text-gray-500 text-xs mt-1">
            Desejo receber comunicações sobre novidades, promoções e conteúdos educativos via{' '}
            <Mail className="w-3 h-3 inline" /> email e WhatsApp.
          </p>
        </label>
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded text-xs text-blue-700 flex items-start gap-2">
        <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Versão da política: {privacyVersion}. Ao continuar, você confirma que leu e entendeu nossa{' '}
          <a href="/privacy" target="_blank" className="underline">
            Política de Privacidade
          </a>{' '}
          e{' '}
          <a href="/terms" target="_blank" className="underline">
            Termos de Uso
          </a>.
        </p>
      </div>
    </div>
  );
}

export default ConsentCheckbox;

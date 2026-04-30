/**
 * Página de Termos de Uso
 */

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Termos de Uso</h1>
          <p className="text-gray-500">
            Última atualização: {new Date().toLocaleDateString('pt-BR')} | Versão: 1.0.0
          </p>
        </div>

        <div className="prose prose-primary max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Aceitação dos Termos</h2>
            
            <p className="text-gray-700 mb-4">
              Ao acessar e usar o Afeto SAC, você concorda em cumprir estes Termos de Uso. 
              Se você não concordar com qualquer parte destes termos, não deverá usar nossa plataforma.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Descrição do Serviço</h2>
            
            <p className="text-gray-700 mb-4">
              O Afeto SAC é uma plataforma de atendimento ao cliente para clínicas de saúde, 
              permitindo comunicação via WhatsApp e outros canais, gestão de pacientes, 
              agendamentos e prontuários.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Cadastro e Conta</h2>
            
            <p className="text-gray-700 mb-4">Para usar o sistema, você deve:</p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Ser maior de 18 anos ou ter autorização do responsável legal</li>
              <li>Fornecer informações verdadeiras, precisas e atualizadas</li>
              <li>Manter a confidencialidade de suas credenciais de acesso</li>
              <li>Notificar imediatamente qualquer uso não autorizado da conta</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Uso Aceitável</h2>
            
            <p className="text-gray-700 mb-4">Você concorda em não:</p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Usar o sistema para fins ilegais ou não autorizados</li>
              <li>Tentar acessar áreas restritas sem autorização</li>
              <li>Interferir na segurança ou disponibilidade do serviço</li>
              <li>Transmitir malware ou código malicioso</li>
              <li>Violar direitos de privacidade de outros usuários</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Propriedade Intelectual</h2>
            
            <p className="text-gray-700 mb-4">
              Todo o conteúdo do Afeto SAC, incluindo código, design, logos e marcas, 
              é propriedade exclusiva da empresa ou de seus licenciadores e está protegido 
              por leis de direitos autorais e propriedade intelectual.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Limitação de Responsabilidade</h2>
            
            <p className="text-gray-700 mb-4">
              O Afeto SAC não se responsabiliza por:
            </p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Interrupções do serviço por causas técnicas ou de força maior</li>
              <li>Perda de dados decorrente de falha do usuário em fazer backup</li>
              <li>Danos causados por uso indevido da plataforma</li>
              <li>Decisões médicas tomadas com base nas informações do sistema</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Modificações</h2>
            
            <p className="text-gray-700 mb-4">
              Reservamos o direito de modificar estes termos a qualquer momento. 
              Alterações significativas serão notificadas com antecedência. 
              O uso continuado após as alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Contato</h2>
            
            <p className="text-gray-700 mb-4">
              Para questões sobre estes termos, entre em contato:
              <br />
              E-mail: <a href="mailto:legal@afeto.com" className="text-primary-600 underline">legal@afeto.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

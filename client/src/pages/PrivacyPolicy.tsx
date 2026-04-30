/**
 * Página de Política de Privacidade
 * Conformidade LGPD/GDPR
 */

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Política de Privacidade</h1>
          <p className="text-gray-500">
            Última atualização: {new Date().toLocaleDateString('pt-BR')} | Versão: 1.0.0
          </p>
        </div>

        <div className="prose prose-primary max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Introdução</h2>
            <p className="text-gray-700 mb-4">
              O Afeto SAC está comprometido em proteger sua privacidade. Esta Política de Privacidade 
              explica como coletamos, usamos, armazenamos e protegemos seus dados pessoais, em 
              conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018) e o 
              Regulamento Geral de Proteção de Dados da UE (GDPR).
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Dados que Coletamos</h2>
            <p className="text-gray-700 mb-4">Coletamos os seguintes tipos de dados:</p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Dados de identificação:</strong> Nome, e-mail, telefone</li>
              <li><strong>Dados de saúde:</strong> Informações médicas, histórico de tratamentos, alergias
              (dados sensíveis conforme LGPD)</li>
              <li><strong>Dados de comunicação:</strong> Histórico de mensagens e atendimentos</li>
              <li><strong>Dados de navegação:</strong> IP, User-Agent, logs de acesso</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Finalidade do Tratamento</h2>
            
            <p className="text-gray-700 mb-4">Utilizamos seus dados para:</p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Prestação de serviços de atendimento e agendamento</li>
              <li>Comunicação sobre consultas e tratamentos</li>
              <li>Envio de lembretes e notificações (com seu consentimento)</li>
              <li>Marketing e comunicações promocionais (apenas com consentimento explícito)</li>
              <li>Cumprimento de obrigações legais e regulatórias</li>
              <li>Proteção e segurança de nossos sistemas</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Base Legal</h2>
            
            <p className="text-gray-700 mb-4">O tratamento de seus dados é realizado com base nas seguintes hipóteses legais:</p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Consentimento (Art. 7º, I LGPD):</strong> Para envio de marketing e comunicações promocionais</li>
              <li><strong>Execução de contrato (Art. 7º, V LGPD):</strong> Para prestação dos serviços de atendimento</li>
              <li><strong>Proteção da vida (Art. 7º, II LGPD):</strong> Para dados de saúde necessários ao atendimento</li>
              <li><strong>Cumprimento de obrigação legal (Art. 7º, II LGPD):</strong> Retenção de prontuários conforme legislação médica</li>
              <li><strong>Legítimo interesse (Art. 7º, IX LGPD):</strong> Para segurança e prevenção de fraudes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Compartilhamento de Dados</h2>
            
            <p className="text-gray-700 mb-4">Seus dados podem ser compartilhados com:</p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Profissionais de saúde:</strong> Médicos, terapeutas e equipe de atendimento</li>
              <li><strong>Prestadores de serviço:</strong> Empresas de tecnologia que nos auxiliam (WhatsApp Business API, Supabase)</li>
              <li><strong>Autoridades:</strong> Quando exigido por lei ou ordem judicial</li>
            </ul>
            
            <p className="text-gray-700 mt-4">
              <strong>Importante:</strong> Não vendemos seus dados para terceiros.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Retenção de Dados</h2>
            
            <p className="text-gray-700 mb-4">
              Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política:
            </p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Prontuários médicos:</strong> 20 anos (conforme Resolução CFM 1.638/2002)</li>
              <li><strong>Dados cadastrais:</strong> Enquanto durar o relacionamento + 5 anos (prescrição legal)</li>
              <li><strong>Logs de acesso:</strong> 5 anos (conforme LGPD)</li>
              <li><strong>Dados de marketing:</strong> Até revogação do consentimento</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Seus Direitos (LGPD)</h2>
            
            <p className="text-gray-700 mb-4">Você tem os seguintes direitos:</p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Confirmação e acesso:</strong> Saber se tratamos seus dados e acessá-los</li>
              <li><strong>Correção:</strong> Corrigir dados incompletos, inexatos ou desatualizados</li>
              <li><strong>Anonimização, bloqueio ou eliminação:</strong> Direito ao esquecimento</li>
              <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
              <li><strong>Revogação do consentimento:</strong> Retirar seu consentimento a qualquer momento</li>
              <li><strong>Informação:</strong> Saber com quem seus dados foram compartilhados</li>
              <li><strong>Oposição:</strong> Discordar do tratamento baseado em legítimo interesse</li>
            </ul>
            
            <p className="text-gray-700 mt-4">
              Para exercer seus direitos, entre em contato com nosso DPO (Data Protection Officer) através do e-mail:{' '}
              <a href="mailto:dpo@afeto.com" className="text-primary-600 underline">
                dpo@afeto.com
              </a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. Segurança</h2>
            
            <p className="text-gray-700 mb-4">
              Implementamos medidas técnicas e organizacionais para proteger seus dados:
            </p>
            
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Criptografia em trânsito (HTTPS/TLS 1.3)</li>
              <li>Criptografia em repouso (AES-256)</li>
              <li>Controle de acesso baseado em função (RBAC)</li>
              <li>Logs de auditoria de acesso</li>
              <li>Backups regulares e criptografados</li>
              <li>Treinamento de equipe em proteção de dados</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Cookies e Tecnologias Similares</h2>
            
            <p className="text-gray-700 mb-4">
              Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos 
              para melhorar nossa experiência. Você pode gerenciar suas preferências de cookies 
              através do banner de consentimento exibido no primeiro acesso.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Alterações nesta Política</h2>
            
            <p className="text-gray-700 mb-4">
              Podemos atualizar esta política periodicamente. Notificaremos você sobre alterações 
              significativas através do e-mail cadastrado ou através de aviso na plataforma. 
              A data da última atualização é sempre exibida no início deste documento.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Contato</h2>
            
            <p className="text-gray-700 mb-4">
              Se tiver dúvidas sobre esta Política de Privacidade ou desejar exercer seus direitos:
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700">
                <strong>Data Protection Officer (DPO):</strong>
                <br />
                E-mail: <a href="mailto:dpo@afeto.com" className="text-primary-600 underline">dpo@afeto.com</a>
                <br />
                Endereço: [Endereço da clínica]
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

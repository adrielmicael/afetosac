import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@afeto.com' },
    update: {},
    create: {
      email: 'admin@afeto.com',
      name: 'Administrador',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('Admin user created:', admin.email);

  // Create agent user
  const agentPassword = await bcrypt.hash('agent123', 10);
  const agent = await prisma.user.upsert({
    where: { email: 'agent@afeto.com' },
    update: {},
    create: {
      email: 'agent@afeto.com',
      name: 'Atendente',
      password: agentPassword,
      role: 'AGENT',
    },
  });
  console.log('Agent user created:', agent.email);

  // Create therapies
  const therapies = [
    { name: 'Fonoaudiologia', color: '#3b82f6' },
    { name: 'Psicologia', color: '#a855f7' },
    { name: 'Terapia Ocupacional', color: '#f59e0b' },
    { name: 'Fisioterapia', color: '#10b981' },
    { name: 'Psicopedagogia', color: '#ec4899' },
    { name: 'Neuropsicologia', color: '#6366f1' },
  ];

  for (const therapy of therapies) {
    await prisma.therapy.upsert({
      where: { id: therapy.name },
      update: {},
      create: therapy,
    });
  }
  console.log('Therapies created');

  // Create quick replies
  const quickReplies = [
    {
      title: 'Saudação',
      content: 'Olá! Como posso ajudar você hoje?',
      category: 'Geral',
    },
    {
      title: 'Confirmação de Sessão',
      content: 'Sua sessão está confirmada para o horário agendado.',
      category: 'Agenda',
    },
    {
      title: 'Terapeuta Aguardando',
      content: 'O terapeuta já está aguardando na sala.',
      category: 'Agenda',
    },
    {
      title: 'Horário Indisponível',
      content: 'Infelizmente não temos esse horário disponível no momento. Posso verificar outras opções?',
      category: 'Agenda',
    },
    {
      title: 'Solicitar Carteirinha',
      content: 'Poderia me enviar a foto da carteirinha do convênio?',
      category: 'Documentos',
    },
  ];

  for (const reply of quickReplies) {
    await prisma.quickReply.upsert({
      where: { id: reply.title },
      update: {},
      create: reply,
    });
  }
  console.log('Quick replies created');

  // Create templates
  const templates = [
    {
      name: 'lembrete_agenda',
      description: 'Lembrete de consulta agendada',
      content: 'Olá, {{1}}! O horário de {{2}} está confirmado para {{3}}. Por favor, confirme sua presença.',
      variables: JSON.stringify(['nome', 'terapia', 'data']),
      category: 'APPOINTMENT',
    },
    {
      name: 'confirmacao_presenca',
      description: 'Confirmação de presença recebida',
      content: 'Obrigado por confirmar sua presença! Te esperamos no horário agendado.',
      category: 'UTILITY',
    },
    {
      name: 'reagendamento',
      description: 'Solicitação de reagendamento',
      content: 'Olá {{1}}, precisamos reagendar sua consulta de {{2}}. Por favor, nos informe sua disponibilidade.',
      variables: JSON.stringify(['nome', 'terapia']),
      category: 'APPOINTMENT',
    },
  ];

  for (const template of templates) {
    await prisma.template.upsert({
      where: { name: template.name },
      update: {},
      create: template,
    });
  }
  console.log('Templates created');

  // Create tags
  const tags = [
    { label: 'Urgente', color: '#ef4444' },
    { label: 'Fono', color: '#3b82f6' },
    { label: 'Psico', color: '#a855f7' },
    { label: 'T.O.', color: '#f59e0b' },
    { label: 'Novo Lead', color: '#10b981' },
    { label: 'Mensalidade Pendente', color: '#f97316' },
  ];

  for (const tag of tags) {
    await prisma.tag.create({ data: tag });
  }
  console.log('Tags created');

  // Create SLA configs
  const slaConfigs = [
    {
      name: 'Padrão',
      priority: 0,
      firstResponseMinutes: 15,
      resolutionMinutes: 240, // 4 horas
      warningThreshold: 80,
      isDefault: true,
    },
    {
      name: 'VIP',
      priority: 1,
      firstResponseMinutes: 5,
      resolutionMinutes: 120, // 2 horas
      warningThreshold: 80,
      isDefault: false,
    },
    {
      name: 'Urgente',
      priority: 2,
      firstResponseMinutes: 2,
      resolutionMinutes: 60, // 1 hora
      warningThreshold: 70,
      isDefault: false,
    },
  ];

  for (const config of slaConfigs) {
    await prisma.sLAConfig.upsert({
      where: { name: config.name },
      update: {},
      create: config,
    });
  }
  console.log('SLA configs created');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

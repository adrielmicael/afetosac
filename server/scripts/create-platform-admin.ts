/**
 * Cria (ou promove) o super-admin inicial da plataforma.
 *
 * Uso:
 *   PLATFORM_ADMIN_EMAIL=ceo@afeto.com \
 *   PLATFORM_ADMIN_PASSWORD='SenhaForte123' \
 *   PLATFORM_ADMIN_NAME='Equipe Afeto' \
 *   npm run platform:admin
 */
import dotenv from 'dotenv';
import prisma from '../src/config/database';
import { hashPassword, validatePasswordStrength } from '../src/utils/password';

dotenv.config();

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin';

  if (!email || !password) {
    throw new Error(
      'Defina PLATFORM_ADMIN_EMAIL e PLATFORM_ADMIN_PASSWORD no ambiente.'
    );
  }

  validatePasswordStrength(password);
  const hashed = await hashPassword(password);

  const admin = await prisma.platformAdmin.upsert({
    where: { email },
    update: { role: 'SUPERADMIN', isActive: true },
    create: { email, name, password: hashed, role: 'SUPERADMIN', isActive: true },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Super-admin pronto: ${admin.email} (role=${admin.role})`);
  console.log('⚠️  Habilite o 2FA imediatamente após o primeiro login (/api/platform/auth/2fa/setup).');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('❌', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import bcrypt from 'bcryptjs';
import { AppError } from '../middleware/errorHandler';

/**
 * Custo do bcrypt. 12 rounds para dados sensíveis de saúde (LGPD art. 11).
 */
export const BCRYPT_ROUNDS = 12;

/**
 * Política mínima de senha:
 * - pelo menos 10 caracteres
 * - ao menos uma letra minúscula, uma maiúscula e um dígito
 */
const MIN_LENGTH = 10;

export const validatePasswordStrength = (password: unknown): void => {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    throw new AppError(
      `A senha deve ter pelo menos ${MIN_LENGTH} caracteres.`,
      400
    );
  }

  const checks: Array<[RegExp, string]> = [
    [/[a-z]/, 'uma letra minúscula'],
    [/[A-Z]/, 'uma letra maiúscula'],
    [/[0-9]/, 'um número'],
  ];

  const missing = checks
    .filter(([regex]) => !regex.test(password))
    .map(([, label]) => label);

  if (missing.length > 0) {
    throw new AppError(
      `A senha deve conter ${missing.join(', ')}.`,
      400
    );
  }
};

export const hashPassword = (password: string): Promise<string> =>
  bcrypt.hash(password, BCRYPT_ROUNDS);

export const comparePassword = (
  password: string,
  hash: string
): Promise<boolean> => bcrypt.compare(password, hash);

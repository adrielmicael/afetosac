import { PrismaClient } from '../../src/generated/prisma';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';

// Mock do Prisma Client
const prismaMock = mockDeep<PrismaClient>();

jest.mock('../src/config/database', () => ({
  __esModule: true,
  default: prismaMock,
}));

// Mock do logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock do Socket.io
jest.mock('../src/index', () => ({
  io: {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  },
}));

beforeEach(() => {
  mockReset(prismaMock);
});

export { prismaMock };

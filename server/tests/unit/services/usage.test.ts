import { computeUsageForOrg, currentPeriod } from '../../../src/services/usageService';
import { prismaMock } from '../../setup';

describe('usageService.computeUsageForOrg', () => {
  it('agrega contagens e materializa a métrica do período', async () => {
    (prismaMock.message.count as jest.Mock)
      .mockResolvedValueOnce(12) // messagesIn
      .mockResolvedValueOnce(8); // messagesOut
    (prismaMock.chat.count as jest.Mock).mockResolvedValue(5);
    (prismaMock.patient.count as jest.Mock).mockResolvedValue(20);
    (prismaMock.organizationMember.count as jest.Mock).mockResolvedValue(3);
    (prismaMock.usageMetric.upsert as jest.Mock).mockImplementation(({ create }) => create);

    const metric = await computeUsageForOrg('org1', '2026-06');

    expect(metric).toEqual(
      expect.objectContaining({
        organizationId: 'org1',
        period: '2026-06',
        messagesIn: 12,
        messagesOut: 8,
        chatsTotal: 5,
        patientsTotal: 20,
        activeUsers: 3,
      })
    );
    expect(prismaMock.usageMetric.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId_period: { organizationId: 'org1', period: '2026-06' } },
      })
    );
  });

  it('currentPeriod retorna formato YYYY-MM', () => {
    expect(currentPeriod(new Date(Date.UTC(2026, 5, 6)))).toBe('2026-06');
  });
});

import { NotFoundException } from '@nestjs/common';
import { ModulesRegistryService } from './modules-registry.service';
import { ModuleStatEvent } from './module-integration.interface';

describe('ModulesRegistryService', () => {
  let prisma: any;
  let auditLog: any;
  let service: ModulesRegistryService;

  beforeEach(() => {
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      moduleDefinition: { findUnique: jest.fn() },
      statEvent: { groupBy: jest.fn() },
      user: { findMany: jest.fn() },
    };
    service = new ModulesRegistryService(prisma, auditLog);
  });

  describe('applyStatEventWithinTransaction', () => {
    const event: ModuleStatEvent = {
      moduleKey: 'auto-quest',
      userId: 'user-1',
      points: 10,
      reason: 'checkpoint',
      occurredAt: new Date(),
    };

    it('бросает NotFoundException, если модуль не зарегистрирован', async () => {
      const tx = {
        moduleDefinition: { findUnique: jest.fn().mockResolvedValue(null) },
        statEvent: { create: jest.fn() },
        user: { update: jest.fn() },
      };

      await expect(service.applyStatEventWithinTransaction(tx as any, event)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.statEvent.create).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('бросает NotFoundException, если модуль выключен — баллы не начисляются', async () => {
      const tx = {
        moduleDefinition: { findUnique: jest.fn().mockResolvedValue({ key: 'auto-quest', isEnabled: false }) },
        statEvent: { create: jest.fn() },
        user: { update: jest.fn() },
      };

      await expect(service.applyStatEventWithinTransaction(tx as any, event)).rejects.toThrow(
        NotFoundException,
      );
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it('создаёt StatEvent и увеличивает pointsTotal, если модуль включён', async () => {
      const tx = {
        moduleDefinition: { findUnique: jest.fn().mockResolvedValue({ key: 'auto-quest', isEnabled: true }) },
        statEvent: { create: jest.fn().mockResolvedValue({ id: 'stat-1', ...event }) },
        user: { update: jest.fn().mockResolvedValue({ id: 'user-1', pointsTotal: 10 }) },
      };

      const result = await service.applyStatEventWithinTransaction(tx as any, event);

      expect(tx.statEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ moduleKey: 'auto-quest', points: 10 }) }),
      );
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { pointsTotal: { increment: 10 } },
      });
      expect(result.statEvent.id).toBe('stat-1');
    });
  });

  describe('overallLeaderboard', () => {
    it('агрегирует баллы по всем модулям без фильтра по moduleKey', async () => {
      prisma.statEvent.groupBy.mockResolvedValue([
        { userId: 'user-1', _sum: { points: 30 } },
        { userId: 'user-2', _sum: { points: 20 } },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: 'user-1', displayName: 'Иван', avatarUrl: null },
        { id: 'user-2', displayName: 'Пётр', avatarUrl: null },
      ]);

      const result = await service.overallLeaderboard(10);

      expect(prisma.statEvent.groupBy).toHaveBeenCalledWith(
        expect.not.objectContaining({ where: expect.anything() }),
      );
      expect(result).toEqual([
        { user: { id: 'user-1', displayName: 'Иван', avatarUrl: null }, points: 30 },
        { user: { id: 'user-2', displayName: 'Пётр', avatarUrl: null }, points: 20 },
      ]);
    });
  });

  describe('assertEnabled', () => {
    it('возвращает определение модуля, если он включён', async () => {
      const moduleDef = { key: 'auto-quest', isEnabled: true };
      prisma.moduleDefinition.findUnique.mockResolvedValue(moduleDef);

      await expect(service.assertEnabled('auto-quest')).resolves.toBe(moduleDef);
    });

    it('бросает исключение, если модуль выключен или не существует', async () => {
      prisma.moduleDefinition.findUnique.mockResolvedValue(null);

      await expect(service.assertEnabled('unknown')).rejects.toThrow();
    });
  });
});

import { BadRequestException, BadGatewayException } from '@nestjs/common';
import { ChatBridgeService } from './chat-bridge.service';

function makeService(overrides: { prisma?: any; auditLog?: any } = {}) {
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        ROCKETCHAT_BASE_URL: 'http://rc.local',
        ROCKETCHAT_WS_URL: 'ws://rc.local/websocket',
        ROCKETCHAT_ADMIN_TOKEN: 'admin-token',
        ROCKETCHAT_ADMIN_USER_ID: 'admin-id',
        CREATE_TOKENS_FOR_USERS_SECRET: 'secret',
      };
      return values[key];
    }),
  };
  const prisma = overrides.prisma ?? {
    user: { findFirst: jest.fn(), update: jest.fn() },
    messageReport: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
  const auditLog = overrides.auditLog ?? { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ChatBridgeService(config as any, prisma, auditLog);
  return { service, prisma, auditLog, config };
}

describe('ChatBridgeService.muteUserInRoom / unmuteUserInRoom', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ ok: true, json: async () => ({}) } as any);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('вызывает channels.muteUser для каналов (roomType c)', async () => {
    const { service, auditLog } = makeService();

    await service.muteUserInRoom('room-1', 'c', 'alexey', 'admin-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://rc.local/api/v1/channels.muteUser',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'chat.mute', targetType: 'RocketChatRoom', targetId: 'room-1' }),
    );
  });

  it('вызывает groups.muteUser для приватных групп (roomType p)', async () => {
    const { service } = makeService();

    await service.muteUserInRoom('room-2', 'p', 'elena', 'admin-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://rc.local/api/v1/groups.muteUser',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('отклоняет мут для личных сообщений (roomType d) — у RC нет такого понятия для DM', async () => {
    const { service } = makeService();

    await expect(service.muteUserInRoom('room-3', 'd', 'alexey', 'admin-1')).rejects.toThrow(BadRequestException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('вызывает unmute-эндпоинт при размуте и пишет chat.unmute в audit log', async () => {
    const { service, auditLog } = makeService();

    await service.unmuteUserInRoom('room-1', 'c', 'alexey', 'admin-1');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://rc.local/api/v1/channels.unmuteUser',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(auditLog.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'chat.unmute' }));
  });

  it('пробрасывает BadGatewayException, если Rocket.Chat отвечает не-ok', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as any);
    const { service } = makeService();

    await expect(service.muteUserInRoom('room-1', 'c', 'alexey', 'admin-1')).rejects.toThrow(BadGatewayException);
  });
});

describe('ChatBridgeService — жалобы на сообщения', () => {
  it('reportMessage создаёт запись через prisma.messageReport.create', async () => {
    const prisma = { messageReport: { create: jest.fn().mockResolvedValue({ id: 'report-1' }) } };
    const { service } = makeService({ prisma });

    const result = await service.reportMessage('room-1', 'msg-1', 'user-1', 'спам');

    expect(prisma.messageReport.create).toHaveBeenCalledWith({
      data: { roomId: 'room-1', msgId: 'msg-1', reporterUserId: 'user-1', reason: 'спам' },
    });
    expect(result).toEqual({ id: 'report-1' });
  });

  it('listReports фильтрует по статусу, если он передан', async () => {
    const prisma = { messageReport: { findMany: jest.fn().mockResolvedValue([]) } };
    const { service } = makeService({ prisma });

    await service.listReports('OPEN' as any);

    expect(prisma.messageReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'OPEN' } }),
    );
  });

  it('listReports без статуса возвращает все жалобы', async () => {
    const prisma = { messageReport: { findMany: jest.fn().mockResolvedValue([]) } };
    const { service } = makeService({ prisma });

    await service.listReports();

    expect(prisma.messageReport.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });

  it('resolveReport обновляет статус и пишет audit log с учётом roomId/msgId', async () => {
    const prisma = {
      messageReport: {
        update: jest.fn().mockResolvedValue({ id: 'report-1', roomId: 'room-1', msgId: 'msg-1', status: 'RESOLVED' }),
      },
    };
    const auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    const { service } = makeService({ prisma, auditLog });

    await service.resolveReport('report-1', 'RESOLVED', 'admin-1', '127.0.0.1');

    expect(prisma.messageReport.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: { status: 'RESOLVED' },
    });
    expect(auditLog.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'chat.report.resolve',
      targetType: 'MessageReport',
      targetId: 'report-1',
      metadata: { roomId: 'room-1', msgId: 'msg-1' },
      ipAddress: '127.0.0.1',
    });
  });
});

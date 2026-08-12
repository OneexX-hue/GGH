import { UsersService } from './users.service';

describe('UsersService.ban', () => {
  let prisma: any;
  let auditLog: any;
  let chatBridge: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = { user: { update: jest.fn() } };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    chatBridge = { setUserActive: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(prisma, auditLog, chatBridge);
  });

  it('деактивирует пользователя в Rocket.Chat, если у него есть rocketChatUserId', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      status: 'BANNED',
      rocketChatUserId: 'rc-user-1',
    });

    await service.ban('user-1', 'admin-1');

    expect(chatBridge.setUserActive).toHaveBeenCalledWith('rc-user-1', false);
  });

  it('не трогает Rocket.Chat, если у пользователя нет rocketChatUserId', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      status: 'BANNED',
      rocketChatUserId: null,
    });

    await service.ban('user-1', 'admin-1');

    expect(chatBridge.setUserActive).not.toHaveBeenCalled();
  });

  it('записывает событие в audit log с действием user.ban', async () => {
    prisma.user.update.mockResolvedValue({ id: 'user-1', status: 'BANNED', rocketChatUserId: null });

    await service.ban('user-1', 'admin-1', '127.0.0.1');

    expect(auditLog.record).toHaveBeenCalledWith({
      actorUserId: 'admin-1',
      action: 'user.ban',
      targetType: 'User',
      targetId: 'user-1',
      ipAddress: '127.0.0.1',
    });
  });

  it('не отдаёт rocketChatUserId наружу в ответе', async () => {
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      status: 'BANNED',
      rocketChatUserId: 'rc-user-1',
      displayName: 'Иван',
    });

    const result = await service.ban('user-1', 'admin-1');

    expect(result).not.toHaveProperty('rocketChatUserId');
  });
});

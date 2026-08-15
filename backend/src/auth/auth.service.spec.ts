import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let prisma: any;
  let invitesService: any;
  let auditLog: any;
  let jwt: any;
  let totp: any;
  let chatBridge: any;
  let service: AuthService;

  const memberRole = { id: 'role-member', name: 'member' };

  beforeEach(() => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null), // chatAlias не занят
        create: jest.fn(),
      },
      inviteRedemption: { create: jest.fn() },
      userRole: { create: jest.fn() },
    };

    prisma = {
      user: { findUnique: jest.fn() },
      role: { findUnique: jest.fn().mockResolvedValue(memberRole) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
      __tx: tx,
    };

    invitesService = {
      reserveWithinTransaction: jest.fn().mockResolvedValue({ id: 'invite-1' }),
    };
    auditLog = { record: jest.fn().mockResolvedValue(undefined) };
    jwt = {
      sign: jest.fn((payload: { sub: string; type?: string }) =>
        payload.type === 'refresh' ? 'refresh-token' : 'access-token',
      ),
      verify: jest.fn(),
    };
    totp = { verify: jest.fn() };
    chatBridge = { provisionUser: jest.fn().mockResolvedValue(undefined) };

    service = new AuthService(prisma, invitesService, auditLog, jwt, totp, chatBridge);
  });

  describe('register', () => {
    const dto = {
      inviteCode: 'ABCDE',
      email: 'new@carclub.local',
      password: 'TEST-password-123',
      displayName: 'Тестовый участник',
    } as any;

    it('создаёт пользователя и возвращает пару токенов', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // email свободен
      prisma.__tx.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        chatAlias: 'Тихий Ястреб-1234',
      });

      const result = await service.register(dto);

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
      expect(invitesService.reserveWithinTransaction).toHaveBeenCalledWith(
        prisma.__tx,
        dto.inviteCode,
        dto.email,
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.register', actorUserId: 'user-1' }),
      );
    });

    it('передаёт в chat-bridge псевдоним (chatAlias), а не реальное имя', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.__tx.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        chatAlias: 'Тихий Ястреб-1234',
      });

      await service.register(dto);

      expect(chatBridge.provisionUser).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Тихий Ястреб-1234' }),
      );
      const callArg = chatBridge.provisionUser.mock.calls[0][0];
      expect(callArg.displayName).not.toBe(dto.displayName);
    });

    it('бросает ConflictException, если email уже занят', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.__tx.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('бросает UnauthorizedException для несуществующего пользователя', async () => {
      prisma.user.findUnique = undefined;
      prisma.user = { findFirst: jest.fn().mockResolvedValue(null) };

      await expect(
        service.login({ identifier: 'nobody@carclub.local', password: 'x' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('бросает UnauthorizedException при неверном пароле', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.user = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          status: 'ACTIVE',
          passwordHash,
          twoFactorEnabled: false,
        }),
      };

      await expect(
        service.login({ identifier: 'user@carclub.local', password: 'wrong-password' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('требует totpCode, если у пользователя включена 2FA', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.user = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          status: 'ACTIVE',
          passwordHash,
          twoFactorEnabled: true,
          twoFactorSecret: 'secret',
        }),
      };

      await expect(
        service.login({ identifier: 'user@carclub.local', password: 'correct-password' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('возвращает токены при верных логине/пароле без 2FA', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      prisma.user = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'user-1',
          status: 'ACTIVE',
          passwordHash,
          twoFactorEnabled: false,
        }),
      };

      const result = await service.login({
        identifier: 'user@carclub.local',
        password: 'correct-password',
      } as any);

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });

    it('бросает UnauthorizedException для забаненного аккаунта', async () => {
      prisma.user = {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1', status: 'BANNED' }),
      };

      await expect(
        service.login({ identifier: 'user@carclub.local', password: 'x' } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

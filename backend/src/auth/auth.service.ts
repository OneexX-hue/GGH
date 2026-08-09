import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { InvitesService } from '../invites/invites.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ChatBridgeService } from '../chat-bridge/chat-bridge.service';
import { TotpService } from './totp.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitesService: InvitesService,
    private readonly auditLog: AuditLogService,
    private readonly jwt: JwtService,
    private readonly totp: TotpService,
    private readonly chatBridge: ChatBridgeService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string) {
    const contact = dto.email ?? dto.phone;
    if (!contact) {
      throw new BadRequestException('Укажите email или телефон');
    }

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) throw new ConflictException('Пользователь с таким email уже существует');
    }
    if (dto.phone) {
      const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
      if (existing) throw new ConflictException('Пользователь с таким телефоном уже существует');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const memberRole = await this.prisma.role.findUnique({ where: { name: 'member' } });

    const user = await this.prisma.$transaction(async (tx) => {
      const invite = await this.invitesService.reserveWithinTransaction(tx, dto.inviteCode, contact);

      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          displayName: dto.displayName,
          status: 'ACTIVE',
        },
      });

      await tx.inviteRedemption.create({
        data: { inviteId: invite.id, userId: createdUser.id },
      });

      if (memberRole) {
        await tx.userRole.create({
          data: { userId: createdUser.id, roleId: memberRole.id },
        });
      }

      return createdUser;
    });

    await this.auditLog.record({
      actorUserId: user.id,
      action: 'user.register',
      targetType: 'User',
      targetId: user.id,
      metadata: { via: 'invite', inviteCode: dto.inviteCode },
      ipAddress,
    });

    // Best-effort, не блокирует регистрацию, если Rocket.Chat ещё не поднят.
    void this.chatBridge.provisionUser({
      userId: user.id,
      displayName: user.displayName,
      email: user.email ?? undefined,
    });

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { phone: dto.identifier }] },
    });
    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    if (user.twoFactorEnabled) {
      if (!dto.totpCode) {
        throw new UnauthorizedException('Требуется код двухфакторной аутентификации');
      }
      if (!user.twoFactorSecret || !this.totp.verify(dto.totpCode, user.twoFactorSecret)) {
        throw new UnauthorizedException('Неверный код двухфакторной аутентификации');
      }
    }

    return this.issueTokens(user.id);
  }

  async enable2faStart(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = this.totp.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });
    return { secret, otpauthUrl: this.totp.keyUri(user.email ?? user.phone ?? user.id, secret) };
  }

  async enable2faConfirm(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.twoFactorSecret || !this.totp.verify(code, user.twoFactorSecret)) {
      throw new BadRequestException('Неверный код подтверждения');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { enabled: true };
  }

  private issueTokens(userId: string) {
    const accessToken = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });
    const refreshToken = this.jwt.sign({ sub: userId, type: 'refresh' }, { expiresIn: '7d' });
    return { accessToken, refreshToken };
  }
}

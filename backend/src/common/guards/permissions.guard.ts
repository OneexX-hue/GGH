import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';

// Права загружаются из БД на каждый запрос (не кэшируются в JWT), чтобы отзыв
// роли/права применялся немедленно, а не только после переиздания токена.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // getAllAndOverride, а не get(..., context.getHandler()): декоратор,
    // применённый на уровне класса (см. ChatModerationController,
    // ModulesRegistryController), не читается через getHandler() в одиночку —
    // это молча пропускало проверку прав для таких контроллеров.
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    if (!userId) {
      throw new ForbiddenException('Не авторизован');
    }

    const count = await this.prisma.userRole.count({
      where: {
        userId,
        role: {
          permissions: {
            some: { permission: { key: requiredPermission } },
          },
        },
      },
    });

    if (count === 0) {
      throw new ForbiddenException(`Недостаточно прав: требуется "${requiredPermission}"`);
    }

    // ТЗ гл. 3.1/4: 2FA обязательна для ролей с административными правами.
    // Сам логин ею не блокируется (иначе включить 2FA было бы неоткуда —
    // /auth/2fa/start требует уже залогиненной сессии), но выполнение любого
    // действия за @RequirePermission требует включённой 2FA у аккаунта.
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
    if (!user?.twoFactorEnabled) {
      throw new ForbiddenException(
        'Для этого действия требуется включённая двухфакторная аутентификация (2FA) — включите её в настройках профиля',
      );
    }

    return true;
  }
}

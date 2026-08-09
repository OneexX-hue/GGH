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
    const requiredPermission = this.reflector.get<string | undefined>(PERMISSION_KEY, context.getHandler());
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

    return true;
  }
}

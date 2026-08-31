import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_LOCKED_KEY } from '../decorators/allow-locked.decorator';
import { RequestAccount } from '../types';

/**
 * Пока психолог не сменил временный пароль и не подключил TOTP, до рабочих
 * разделов его не пускаем — доступны только маршруты самой настройки,
 * помеченные @AllowLocked.
 */
@Injectable()
export class SetupGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowLocked = this.reflector.getAllAndOverride<boolean>(ALLOW_LOCKED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic || allowLocked) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ account?: RequestAccount }>();
    const account = request.account;
    if (!account) {
      return true;
    }
    if (account.mustChangePassword) {
      throw new ForbiddenException('Сначала смените временный пароль');
    }
    if (account.role === AccountRole.PSYCHOLOGIST && !account.totpEnabled) {
      throw new ForbiddenException('Сначала подключите двухфакторную аутентификацию');
    }
    return true;
  }
}

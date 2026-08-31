import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestAccount } from '../types';

export const CurrentAccount = createParamDecorator(
  (field: keyof RequestAccount | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ account?: RequestAccount }>();
    const account = request.account;
    if (!account) {
      return undefined;
    }
    return field ? account[field] : account;
  },
);

import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AuthService } from './auth.service';
import { Public } from '../common/decorators/public.decorator';
import { AllowLocked } from '../common/decorators/allow-locked.decorator';
import { CurrentAccount } from '../common/decorators/current-account.decorator';
import { RequestAccount, SESSION_COOKIE } from '../common/types';
import {
  ChangePasswordDto,
  ConfirmTotpDto,
  LoginDto,
  SetPinDto,
  TotpLoginDto,
  UnlockDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  private context(req: FastifyRequest) {
    return { ip: req.ip ?? '', userAgent: String(req.headers['user-agent'] ?? '').slice(0, 250) };
  }

  private setCookie(reply: FastifyReply, token: string, expiresAt: Date): void {
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      path: '/',
      expires: expiresAt,
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(dto.login, dto.password, this.context(req));
    if (result.stage === 'totp') {
      return { stage: 'totp', ticket: result.ticket };
    }
    this.setCookie(reply, result.token, result.expiresAt);
    return { stage: 'session', profile: result.profile };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login/totp')
  @HttpCode(200)
  async loginTotp(
    @Body() dto: TotpLoginDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.completeTotpLogin(dto.ticket, dto.code, this.context(req));
    this.setCookie(reply, result.token, result.expiresAt);
    return { stage: 'session', profile: result.profile };
  }

  @AllowLocked()
  @Get('me')
  me(@CurrentAccount() account: RequestAccount) {
    return this.auth.profile(account.id, account.sessionId);
  }

  @AllowLocked()
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentAccount() account: RequestAccount, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(account.sessionId);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @AllowLocked()
  @Post('password')
  @HttpCode(200)
  async changePassword(@CurrentAccount() account: RequestAccount, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(account.id, dto.currentPassword, dto.newPassword);
    return this.auth.profile(account.id, account.sessionId);
  }

  @AllowLocked()
  @Post('totp/setup')
  @HttpCode(200)
  startTotp(@CurrentAccount() account: RequestAccount) {
    return this.auth.startTotpSetup(account.id);
  }

  @AllowLocked()
  @Post('totp/confirm')
  @HttpCode(200)
  confirmTotp(@CurrentAccount() account: RequestAccount, @Body() dto: ConfirmTotpDto) {
    return this.auth.confirmTotpSetup(account.id, dto.code);
  }

  @Post('backup-codes')
  @HttpCode(200)
  regenerateBackupCodes(@CurrentAccount() account: RequestAccount) {
    return this.auth.regenerateBackupCodes(account.id);
  }

  @AllowLocked()
  @Post('pin')
  @HttpCode(200)
  async setPin(@CurrentAccount() account: RequestAccount, @Body() dto: SetPinDto) {
    await this.auth.setPin(account.id, dto.pin, dto.currentPin, dto.intervalMinutes);
    return this.auth.profile(account.id, account.sessionId);
  }

  @AllowLocked()
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post('unlock')
  @HttpCode(200)
  async unlock(@CurrentAccount() account: RequestAccount, @Body() dto: UnlockDto) {
    await this.auth.unlock(account, dto.pin);
    return this.auth.profile(account.id, account.sessionId);
  }

  @Post('lock')
  @HttpCode(200)
  async lock(@CurrentAccount() account: RequestAccount) {
    await this.auth.lock(account.sessionId);
    return { ok: true };
  }

  @Get('sessions')
  listSessions(@CurrentAccount() account: RequestAccount) {
    return this.auth.listSessions(account.id, account.sessionId);
  }

  @Delete('sessions/:id')
  async revokeSession(@CurrentAccount() account: RequestAccount, @Param('id') id: string) {
    await this.auth.revokeSession(account.id, id);
    return { ok: true };
  }

  @Delete('sessions')
  revokeOthers(@CurrentAccount() account: RequestAccount) {
    return this.auth.revokeOtherSessions(account.id, account.sessionId);
  }
}

import { Body, Controller, Delete, Get, Header, Param, Post, Query } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { RunsService } from './runs.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { IdentifyDto, RunQueryDto, SubmitRunDto } from './dto/runs.dto';

@Controller('runs')
@Roles(AccountRole.PSYCHOLOGIST)
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Get()
  list(@Query() query: RunQueryDto) {
    return this.runs.list(query);
  }

  @Get('abandoned')
  abandoned() {
    return this.runs.abandoned();
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="results.csv"')
  exportCsv(@Query() query: RunQueryDto) {
    return this.runs.exportCsv(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.runs.detail(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.runs.remove(id);
  }
}

/**
 * Публичная часть: сюда попадает ученик, отсканировавший QR. Авторизации нет,
 * поэтому всё ограничено кодом из приглашения и жёстко throttl'ится.
 */
@Controller('public')
@Public()
export class PublicRunsController {
  constructor(private readonly runs: RunsService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('invite/:code')
  inspect(@Param('code') code: string) {
    return this.runs.inspect(code);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('invite/:code/start')
  start(@Param('code') code: string, @Body() dto: IdentifyDto) {
    return this.runs.start(code, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('submit')
  submit(@Body() dto: SubmitRunDto) {
    return this.runs.submit(dto.runToken, dto.responses);
  }
}

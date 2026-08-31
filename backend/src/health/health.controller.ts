import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let database = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    // Поле app — метка платформы: по ней deploy.sh убеждается, что на порту
    // отвечаем именно мы, а не чужое приложение, занявшее его раньше.
    return {
      app: 'psychologic',
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      time: new Date().toISOString(),
    };
  }
}

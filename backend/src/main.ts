import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildBanner } from './common/banner';

async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    // За Caddy — доверяем X-Forwarded-*, иначе в журнале сессий будет IP прокси.
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: false,
  });
  const config = app.get(ConfigService);

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(fastifyCookie, { secret: config.getOrThrow<string>('JWT_SECRET') });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // В проде фронт и API стоят за одним Caddy на одном домене, поэтому CORS
  // нужен только для локальной разработки с vite на 5173.
  const origin = config.get<string>('FRONTEND_ORIGIN');
  if (origin) {
    app.enableCors({ origin: origin.split(',').map((o) => o.trim()), credentials: true });
  }

  const port = Number(config.get('PORT', 3000));
  await app.listen(port, '0.0.0.0');
  Logger.log(buildBanner(port, config.get<string>('NODE_ENV', 'development')), 'Bootstrap');
}

void bootstrap();

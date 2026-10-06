import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { accessLogMiddleware, requestIdMiddleware } from './common/request-context';
import { originCheckMiddleware } from './common/origin-check.middleware';
import { webOrigins, type Env } from './config/env';

/** Middlewares e configuração HTTP — compartilhado com os testes e2e. */
export function configurarApp(app: INestApplication, env: Pick<Env, 'WEB_ORIGIN' | 'TRUST_PROXY'>) {
  const express = app as NestExpressApplication;
  const origens = webOrigins(env);

  // IP real do cliente atrás do proxy do Next / load balancer (auditoria e rate limit)
  express.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));

  app.use(requestIdMiddleware);
  app.use(accessLogMiddleware);
  app.use(helmet());
  // Limite explícito de payload (o maior request legítimo é o de suitability, ~2 KB)
  express.useBodyParser('json', { limit: '100kb' });
  express.useBodyParser('urlencoded', { extended: false, limit: '20kb' });
  app.use(cookieParser());
  app.use(originCheckMiddleware(origens));

  app.enableCors({ origin: origens, credentials: true });
  app.setGlobalPrefix('api');

  // Validação usa Zod por endpoint (ZodValidationPipe) — sem ValidationPipe global.
  app.useGlobalFilters(new AllExceptionsFilter());
}

function parseTrustProxy(v: string): boolean | number | string {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    logger: isProd ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug'],
    bodyParser: false, // configurado em configurarApp com limites explícitos
  });
  const config = app.get(ConfigService<Env, true>);

  configurarApp(app, {
    WEB_ORIGIN: config.get('WEB_ORIGIN'),
    TRUST_PROXY: config.get('TRUST_PROXY'),
  });
  app.enableShutdownHooks();

  const port = config.get('API_PORT');
  await app.listen(port);
  Logger.log(`API rodando em http://localhost:${port}/api`, 'Bootstrap');
}

if (require.main === module) {
  bootstrap();
}

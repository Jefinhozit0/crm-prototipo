import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Validação usa Zod por endpoint — sem ValidationPipe global aqui.
  // Ordem importa: o último registrado fica como fallback. AllExceptionsFilter
  // captura tudo que não foi tratado pelo PrismaExceptionFilter (mais específico).
  app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter());

  const port = Number(process.env.API_PORT) || 3333;
  await app.listen(port);

  Logger.log(`🚀 API rodando em http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();

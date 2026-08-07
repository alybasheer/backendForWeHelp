import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const isCorsWildcard = !corsOrigin || corsOrigin === '*';

  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.enableCors({
    origin: isCorsWildcard ? true : corsOrigin.split(',').map(s => s.trim()).filter(Boolean),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: !isCorsWildcard,
  });

  // Use NestJS built-in logger for requests
  const logger = new Logger('HTTP');
  app.use((req, res, next) => {
    res.on('finish', () => {
      logger.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
    });
    next()
  })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server is running on http://0.0.0.0:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

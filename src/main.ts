import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const allowAnyOrigin = !corsOrigin || corsOrigin === '*';
  const allowedOrigins = allowAnyOrigin
    ? true
    : corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: !allowAnyOrigin,
  });

  app.use((req: any, _res: any, next: any) => {
    const origin =
      (req.headers && (req.headers.origin || req.headers.host)) || '-';
    console.log(
      `[REQ] ${new Date().toISOString()} ${req.method} ${req.url} origin=${origin}`,
    );
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }),
  );

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Server is running on http://0.0.0.0:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

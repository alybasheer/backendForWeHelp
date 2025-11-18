import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for the web client. Configure origins in production via env.
  // Configure CORS: in production set CORS_ORIGIN to a comma-separated list of allowed origins.
  // Using `origin: true` reflects the request origin which is useful for multi-origin setups.
  const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : undefined;
  app.enableCors({
    origin: allowedOrigins ?? true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['Authorization'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Simple origin logger to help debug CORS issues (will log each request's origin)
  app.use((req: any, _res: any, next: any) => {
    try {
      const origin = req.headers && (req.headers.origin || req.headers.host);
      if (origin) console.debug('[CORS] request origin:', origin);
    } catch (e) { }
    next();
  });

  // Verbose request logger: prints method + url + origin for every request
  app.use((req: any, _res: any, next: any) => {
    try {
      const origin = req.headers && (req.headers.origin || req.headers.host) || '-';
      console.log(`[REQ] ${new Date().toISOString()} ${req.method} ${req.url} origin=${origin}`);
    } catch (e) {
      // ignore
    }
    next();
  });

  // Security headers


  // Global validation pipe (will work once DTOs use class-validator)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }));

  const config = new DocumentBuilder()
    .setTitle('Nest Concepts API')
    .setDescription('API documentation for Nest Concepts')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);

}
bootstrap();

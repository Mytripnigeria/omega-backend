// MUST stay the first import: pins the process timezone to the merchant's
// wall clock before any other module is evaluated. See src/timezone.ts.
import './timezone';

import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { json, raw } from 'express';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { requestIdMiddleware } from './common/middleware/request-context';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  // Paystack webhook needs the *raw* body for HMAC signature verification.
  // Mount the raw parser only on that path before the global JSON parser
  // touches it; everything else uses the standard JSON body parser.
  // Assign a correlation id to every request first, so it's available to all
  // downstream logging (access logs + error logs).
  app.use(requestIdMiddleware);

  app.use('/api/webhooks/paystack', raw({ type: '*/*' }));
  app.use(json({ limit: '5mb' }));

  // Production hardening: security headers via helmet. Disable CSP — the API
  // serves JSON, not HTML, and CSP would interfere with Swagger in dev.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // `origin: true` reflects the request's Origin header — required for
  // credentialed requests since browsers reject `Access-Control-Allow-Origin: *`
  // when `credentials: true`.
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Marketplace webhooks are excluded from the /api prefix: the URLs already
  // registered with Chowdeck are of the form
  // https://app.omega.com.ng/webhook/chowdeck[/{token}], and a third party
  // can't be asked to change them.
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'webhook/chowdeck', method: RequestMethod.POST },
      { path: 'webhook/chowdeck/:token', method: RequestMethod.POST },
      { path: 'webhook/cloveai', method: RequestMethod.POST },
      { path: 'webhook/cloveai/:token', method: RequestMethod.POST },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new LoggingInterceptor(), new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Mr. Jollof API')
      .setDescription('Restaurant management system API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}/api`);
  if (nodeEnv !== 'production') {
    console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  }
}

bootstrap();

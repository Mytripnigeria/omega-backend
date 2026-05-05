import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  // Reflect the request's Origin header so any origin is allowed while still
  // satisfying browsers that require an explicit origin (not `*`) when
  // credentials are sent.
  app.enableCors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
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

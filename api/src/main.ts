import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './upload/upload.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.set('trust proxy', 1); // proxy-r pichone thakle asol client IP pete
 app.useBodyParser('json', { limit: '8mb' });
  app.use(compression()); // JSON response gzip hobe, 5-10x choto
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow the web app to load /uploads images
      contentSecurityPolicy: false, // Apollo landing page needs inline scripts in dev
    }),
  );

  const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim());
  app.enableCors({ origin: origins, credentials: true });

  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads', maxAge: '7d' });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`Farse AI API running on http://localhost:${port}/graphql`);
}
bootstrap();

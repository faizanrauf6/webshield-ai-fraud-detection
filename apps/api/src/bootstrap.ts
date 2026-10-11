import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { json } from 'express';
export function configureApp(app: INestApplication) {
  app.use(helmet());
  app.use(json({ limit: '8kb' }));
  app.enableCors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: false,
  });
  app.use(
    (
      _request: unknown,
      response: { setHeader: (key: string, value: string) => void },
      next: () => void,
    ) => {
      response.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  app.enableShutdownHooks();
}

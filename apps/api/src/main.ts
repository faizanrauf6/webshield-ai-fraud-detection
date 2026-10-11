import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import { configureApp } from './bootstrap';
async function main() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  await app.listen(Number(process.env.API_PORT || 4000), process.env.API_HOST || '127.0.0.1');
  console.log('WebShield API ready. Optional integrations follow server configuration.');
}
main().catch(() => {
  console.error(
    'API startup failed. Verify PostgreSQL, Redis, migrations and enabled integration configuration.',
  );
  process.exitCode = 1;
});

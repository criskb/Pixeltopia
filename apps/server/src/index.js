import { buildServer } from './app.js';
import { env } from './config/env.js';

const app = buildServer();

try {
  await app.listen({ host: env.host, port: env.port });
  app.log.info(`server listening on ${env.host}:${env.port}`);
} catch (error) {
  app.log.error(error, 'failed to start server');
  process.exit(1);
}

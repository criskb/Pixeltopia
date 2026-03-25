import { buildServer } from './app.js';
import { env } from './config/env.js';

const server = buildServer();
const httpServer = server.createHttpServer();

httpServer.listen(env.port, env.host, () => {
  console.log(`server listening on ${env.host}:${env.port}`);
});

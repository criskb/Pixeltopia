import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';

import { env } from './config/env.js';
import { loggerConfig } from './config/logger.js';
import { authPlugin } from './auth/auth.plugin.js';
import { storagePlugin } from './storage/storage.plugin.js';
import { jobsPlugin } from './jobs/jobs.plugin.js';
import { healthRoute } from './api/health.route.js';
import { v1Route } from './api/v1.route.js';

export function buildServer() {
  const app = Fastify({ logger: loggerConfig });

  app.register(fastifyHelmet);
  app.register(fastifyCors, { origin: env.corsOrigin });

  app.register(authPlugin);
  app.register(storagePlugin);
  app.register(jobsPlugin);

  app.register(healthRoute);
  app.register(async (v1) => {
    await v1.register(v1Route, { prefix: '/api/v1' });
  });

  return app;
}

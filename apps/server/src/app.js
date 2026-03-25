import { BackendServer } from './core/server.js';

import { logger } from './config/logger.js';
import { createAuthService } from './auth/auth.plugin.js';
import { createStorageService } from './storage/storage.plugin.js';
import { createJobsService } from './jobs/jobs.plugin.js';
import { registerHealthRoute } from './api/health.route.js';
import { registerV1StatusRoute } from './api/v1/status.route.js';

export function buildServer() {
  const server = new BackendServer({ logger });

  server.registerPlugin('auth', createAuthService());
  server.registerPlugin('storage', createStorageService());
  server.registerPlugin('jobs', createJobsService());

  registerHealthRoute(server);
  registerV1StatusRoute(server);

  return server;
}

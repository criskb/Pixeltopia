import { createServer } from 'node:http';

import { Router } from './router.js';
import { internalError, notFound } from '../utils/http.js';

export class BackendServer {
  constructor({ logger }) {
    this.logger = logger;
    this.router = new Router();
    this.plugins = new Map();
  }

  registerPlugin(name, plugin) {
    this.plugins.set(name, plugin);
  }

  route(method, path, handler) {
    this.router.register(method, path, handler);
  }

  createHttpServer() {
    return createServer(async (request, reply) => {
      try {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const handler = this.router.resolve(request.method ?? 'GET', url.pathname);

        if (!handler) {
          return notFound(reply, url.pathname);
        }

        const context = {
          request,
          reply,
          services: Object.fromEntries(this.plugins)
        };

        return await handler(context);
      } catch (error) {
        this.logger.error(error);
        return internalError(reply);
      }
    });
  }
}

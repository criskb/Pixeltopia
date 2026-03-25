import { jsonResponse } from '../utils/http.js';

export function registerHealthRoute(server) {
  server.route('GET', '/health', ({ reply }) =>
    jsonResponse(reply, 200, {
      status: 'ok',
      service: 'pixelforge-server'
    })
  );
}

import { jsonResponse } from '../../utils/http.js';

export function registerV1StatusRoute(server) {
  server.route('GET', '/api/v1/status', ({ reply, services }) =>
    jsonResponse(reply, 200, {
      api: 'v1',
      status: 'ready',
      capabilities: {
        auth: typeof services.auth?.verifySession === 'function',
        storage: typeof services.storage?.ping === 'function',
        jobs: typeof services.jobs?.enqueue === 'function'
      }
    })
  );
}

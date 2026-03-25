import test from 'node:test';
import assert from 'node:assert/strict';

import { buildServer } from './app.js';

async function withRunningServer(run) {
  const server = buildServer();
  const httpServer = server.createHttpServer();

  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));

  const address = httpServer.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      httpServer.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

test('GET /health returns service status', async () => {
  await withRunningServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      status: 'ok',
      service: 'pixelforge-server'
    });
  });
});

test('GET /api/v1/status returns feature capabilities', async () => {
  await withRunningServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/status`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.api, 'v1');
    assert.equal(payload.status, 'ready');
    assert.deepEqual(payload.capabilities, {
      auth: true,
      storage: true,
      jobs: true
    });
  });
});

test('unknown route returns not found', async () => {
  await withRunningServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`);
    const payload = await response.json();

    assert.equal(response.status, 404);
    assert.equal(payload.error, 'not_found');
  });
});

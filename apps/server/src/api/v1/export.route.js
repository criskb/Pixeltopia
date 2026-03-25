import { serializeProjectExport } from '@pixelforge/io';
import { jsonResponse } from '../../utils/http.js';

export async function registerV1ExportRoute(server) {
  server.route('POST', '/api/v1/export', async ({ request, reply }) => {
    const body = await readJsonBody(request);

    if (!body?.project || !body?.settings) {
      return jsonResponse(reply, 400, {
        error: 'invalid_request',
        message: 'project and settings are required'
      });
    }

    const result = serializeProjectExport(body.project, body.settings);

    return jsonResponse(reply, 200, {
      fileName: result.fileName,
      mimeType: result.mimeType,
      width: result.width,
      height: result.height,
      base64: Buffer.from(result.bytes).toString('base64')
    });
  });
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(raw);
}

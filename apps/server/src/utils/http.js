export function jsonResponse(reply, statusCode, payload) {
  reply.statusCode = statusCode;
  reply.setHeader('content-type', 'application/json; charset=utf-8');
  reply.end(JSON.stringify(payload));
}

export function notFound(reply, path) {
  return jsonResponse(reply, 404, {
    error: 'not_found',
    message: `No route registered for ${path}`
  });
}

export function internalError(reply) {
  return jsonResponse(reply, 500, {
    error: 'internal_server_error',
    message: 'Unexpected server error'
  });
}

export async function healthRoute(app) {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'pixelforge-server'
  }));
}

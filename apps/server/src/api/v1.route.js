export async function v1Route(app) {
  app.get('/status', async () => ({
    api: 'v1',
    status: 'ready'
  }));
}

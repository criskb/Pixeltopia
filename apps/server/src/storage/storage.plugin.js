export async function storagePlugin(app) {
  app.decorate('storage', {
    ping: async () => ({ provider: 'local', status: 'unconfigured' })
  });
}

export async function authPlugin(app) {
  app.decorate('auth', {
    verifySession: async () => ({ authenticated: false })
  });
}

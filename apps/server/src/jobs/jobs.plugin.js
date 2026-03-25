export async function jobsPlugin(app) {
  app.decorate('jobs', {
    enqueue: async () => ({ accepted: false, reason: 'queue not configured' })
  });
}

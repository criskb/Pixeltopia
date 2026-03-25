export function createStorageService() {
  return {
    ping() {
      return { provider: 'local', status: 'unconfigured' };
    }
  };
}

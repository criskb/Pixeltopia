export function createAuthService() {
  return {
    verifySession() {
      return { authenticated: false };
    }
  };
}

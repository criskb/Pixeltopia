export class Router {
  constructor() {
    this.routes = new Map();
  }

  register(method, path, handler) {
    const key = this.#routeKey(method, path);
    this.routes.set(key, handler);
  }

  resolve(method, path) {
    return this.routes.get(this.#routeKey(method, path));
  }

  #routeKey(method, path) {
    return `${method.toUpperCase()} ${path}`;
  }
}

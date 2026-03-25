import { env } from './env.js';

const noop = () => {};

export const logger = {
  info: env.nodeEnv === 'test' ? noop : console.log,
  error: console.error
};

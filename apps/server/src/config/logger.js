import { env } from './env.js';

export const loggerConfig = env.nodeEnv === 'test' ? false : true;

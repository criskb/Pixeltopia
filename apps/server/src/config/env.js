const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  port: parseNumber(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*'
};

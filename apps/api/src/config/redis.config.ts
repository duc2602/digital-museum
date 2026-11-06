export function getRedisConnection() {
  const port = Number(process.env.REDIS_PORT ?? 6379);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('REDIS_PORT must be a valid TCP port');
  }

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port,
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  };
}

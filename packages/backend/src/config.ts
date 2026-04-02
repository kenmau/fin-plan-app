/**
 * Environment configuration with validation.
 * Fails fast at startup if required variables are missing.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  node: {
    env: (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production',
    port: parseInt(process.env.PORT ?? '3001', 10),
    host: process.env.HOST ?? '0.0.0.0',
  },
  db: {
    url: process.env.DATABASE_URL ?? 'postgresql://finplan:finplan@localhost:5432/finplan',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? (process.env.NODE_ENV === 'development' ? 'dev-secret-change-in-production' : requireEnv('JWT_SECRET')),
    expiresIn: '30d',
    cookieName: 'token',
  },
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  },
} as const;

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const exampleSecret = 'replace_this_with_a_long_random_secret_at_least_32_characters';
const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.string().trim().min(1).default('development'),
  DATABASE_URL: z.string().trim().min(1, 'is required').refine(
    value => value.startsWith('file:'),
    'must be a SQLite file URL (file:...)',
  ),
  JWT_SECRET: z.string().min(32, 'must contain at least 32 characters').refine(
    value => value !== exampleSecret,
    'must be replaced with a unique random secret',
  ),
  JWT_EXPIRES_IN: z.string().trim().min(1).default('7d'),
});

const parsed = environmentSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map(issue => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid server environment:\n${details}`);
}

export const env = {
  port: parsed.data.PORT,
  clientUrl: parsed.data.CLIENT_URL,
  nodeEnv: parsed.data.NODE_ENV,
  databaseUrl: parsed.data.DATABASE_URL,
  jwtSecret: parsed.data.JWT_SECRET,
  jwtExpiresIn: parsed.data.JWT_EXPIRES_IN,
};

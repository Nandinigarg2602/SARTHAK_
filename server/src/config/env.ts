import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),

  // MongoDB
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  // Gemini AI
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().default(''),
  TWILIO_AUTH_TOKEN: z.string().default(''),
  TWILIO_PHONE_NUMBER: z.string().default(''),

  // JWT
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRY: z.string().default('7d'),

  // Client & Emergency Links
  CLIENT_URL: z.string().default('http://localhost:5173'),
  EMERGENCY_LINK_BASE_URL: z.string().default('http://localhost:5173/emergency'),

  // Demo Mode
  DEMO_MODE: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;

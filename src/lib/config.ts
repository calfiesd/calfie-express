import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_NAME: z.string().default("CALFIE EXPRESS"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  UPS_CLIENT_ID: z.string().optional(),
  UPS_CLIENT_SECRET: z.string().optional(),
  UPS_ACCOUNT_NUMBER: z.string().optional(),
  UPS_API_BASE_URL: z.string().url().default("https://wwwcie.ups.com"),
  ALLOW_LIVE_LABEL_PURCHASE: z.enum(["true", "false"]).default("false"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().email().optional(),
  DEMO_CUSTOMER_EMAIL: z.string().email().default("demo@calfieexpress.com"),
  DEMO_CUSTOMER_PASSWORD: z.string().min(8).default("CalfieDemo123")
});

const parsed = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  UPS_CLIENT_ID: process.env.UPS_CLIENT_ID,
  UPS_CLIENT_SECRET: process.env.UPS_CLIENT_SECRET,
  UPS_ACCOUNT_NUMBER: process.env.UPS_ACCOUNT_NUMBER,
  UPS_API_BASE_URL: process.env.UPS_API_BASE_URL,
  ALLOW_LIVE_LABEL_PURCHASE: process.env.ALLOW_LIVE_LABEL_PURCHASE,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
  POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN,
  POSTMARK_FROM_EMAIL: process.env.POSTMARK_FROM_EMAIL,
  DEMO_CUSTOMER_EMAIL: process.env.DEMO_CUSTOMER_EMAIL,
  DEMO_CUSTOMER_PASSWORD: process.env.DEMO_CUSTOMER_PASSWORD
});

export const env = {
  ...parsed,
  ALLOW_LIVE_LABEL_PURCHASE: parsed.ALLOW_LIVE_LABEL_PURCHASE === "true"
};
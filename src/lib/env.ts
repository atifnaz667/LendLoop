/**
 * Public (browser-safe) configuration. Only NEXT_PUBLIC_* values may appear here.
 * Server secrets live in Convex env vars and n8n credentials, never in the Next.js bundle.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  }
  return value;
}

export const clientEnv = {
  // Next.js inlines NEXT_PUBLIC_* at build time, so each must be referenced literally.
  convexUrl: required("NEXT_PUBLIC_CONVEX_URL", process.env.NEXT_PUBLIC_CONVEX_URL),
};

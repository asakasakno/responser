const PROD_ORIGINS = [
  "https://responser.lovable.app",
];

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const allowedOrigins = new Set([
  ...PROD_ORIGINS,
  ...DEV_ORIGINS,
  ...((Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)),
]);

type CorsOptions = {
  allowHeaders?: string;
  allowMethods?: string;
};

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  return allowedOrigins.has(origin);
}

export function buildCorsHeaders(origin: string | null, options: CorsOptions = {}) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": options.allowHeaders ??
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": options.allowMethods ?? "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

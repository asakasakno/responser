const PROD_ORIGINS = [
  "https://responser.lovable.app",
  "https://xn--vk1booh7ruql6wa.com",
  "https://www.xn--vk1booh7ruql6wa.com",
];

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

// 정확 매칭용 허용 목록
const allowedOrigins = new Set([
  ...PROD_ORIGINS,
  ...DEV_ORIGINS,
  ...((Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)),
]);

// Lovable 프리뷰/샌드박스 도메인 패턴 허용
// 예: https://id-preview--<uuid>.lovable.app, https://<id>.sandbox.lovable.dev, https://<sub>.lovableproject.com
const ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovable\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.sandbox\.lovable\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
];

type CorsOptions = {
  allowHeaders?: string;
  allowMethods?: string;
};

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (allowedOrigins.has(origin)) return true;
  return ORIGIN_PATTERNS.some((re) => re.test(origin));
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

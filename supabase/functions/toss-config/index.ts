// Toss Payments 클라이언트 키(publishable)만 안전하게 노출
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const clientKey = Deno.env.get("TOSS_CLIENT_KEY") ?? "";
  return new Response(JSON.stringify({ clientKey }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

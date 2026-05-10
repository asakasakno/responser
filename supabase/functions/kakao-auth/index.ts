// Kakao OAuth login (custom flow). Two actions:
//   GET  ?action=start&redirect=/dashboard  -> 302 to kakao.com/oauth/authorize
//   GET  ?action=callback&code=...&state=...  (Kakao redirects here)
// On callback, exchange code -> fetch Kakao profile -> create/link Supabase user
// -> generate magic link -> 302 redirect browser to that link to set session.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const KAKAO_REST_API_KEY = Deno.env.get('KAKAO_REST_API_KEY')!;
const KAKAO_CLIENT_SECRET = Deno.env.get('KAKAO_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PROJECT_ID = (Deno.env.get('VITE_SUPABASE_PROJECT_ID') ?? 'qbvlgzmivdycuocvcoxy');

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/kakao-auth?action=callback`;

const ALLOWED_SITE_HOSTS = [
  'responser.lovable.app',
  'xn--vk1booh7ruql6wa.com',
  '응대도우미.com',
  'localhost',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function pickSiteOrigin(req: Request, hint?: string | null): string {
  // Use Origin/Referer to determine where to send the user back after auth.
  const origin = req.headers.get('origin') || req.headers.get('referer');
  if (origin) {
    try {
      const u = new URL(origin);
      if (ALLOWED_SITE_HOSTS.some((h) => u.hostname.endsWith(h))) {
        return `${u.protocol}//${u.host}`;
      }
    } catch (_) { /* ignore */ }
  }
  if (hint) {
    try {
      const u = new URL(hint);
      if (ALLOWED_SITE_HOSTS.some((h) => u.hostname.endsWith(h))) {
        return `${u.protocol}//${u.host}`;
      }
    } catch (_) { /* ignore */ }
  }
  return 'https://responser.lovable.app';
}

function safeRedirect(url: string): Response {
  // Use 302 redirect with Location header. Avoid Response.redirect because some
  // gateways/proxies may strip or not honor it the same way as a manual response.
  return new Response(null, {
    status: 302,
    headers: {
      'Location': url,
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function errorRedirect(siteOrigin: string, msg: string): Response {
  return safeRedirect(`${siteOrigin}/auth?kakao_error=${encodeURIComponent(msg)}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'start';

  try {
    if (action === 'start') {
      const siteOrigin = pickSiteOrigin(req, url.searchParams.get('origin'));
      const redirectAfter = url.searchParams.get('redirect') || '/dashboard';
      const referralCode = (url.searchParams.get('ref') || '').trim().toLowerCase();
      // state encodes site origin + post-login redirect path so callback can return to caller.
      const statePayload = { o: siteOrigin, r: redirectAfter, ref: referralCode || undefined, n: crypto.randomUUID() };
      const state = btoa(JSON.stringify(statePayload));

      const authorize = new URL('https://kauth.kakao.com/oauth/authorize');
      authorize.searchParams.set('response_type', 'code');
      authorize.searchParams.set('client_id', KAKAO_REST_API_KEY);
      authorize.searchParams.set('redirect_uri', REDIRECT_URI);
      authorize.searchParams.set('state', state);
      authorize.searchParams.set('scope', 'account_email profile_nickname');

      return Response.redirect(authorize.toString(), 302);
    }

    if (action === 'callback') {
      const stateRaw = url.searchParams.get('state') || '';
      let siteOrigin = 'https://responser.lovable.app';
      let redirectAfter = '/dashboard';
      let referralCode: string | undefined;
      try {
        const parsed = JSON.parse(atob(stateRaw));
        if (parsed?.o && ALLOWED_SITE_HOSTS.some((h) => new URL(parsed.o).hostname.endsWith(h))) {
          siteOrigin = parsed.o;
        }
        if (typeof parsed?.r === 'string' && parsed.r.startsWith('/')) redirectAfter = parsed.r;
        if (typeof parsed?.ref === 'string' && parsed.ref.length > 0 && parsed.ref.length < 32) referralCode = parsed.ref;
      } catch (_) { /* ignore */ }

      const code = url.searchParams.get('code');
      const kakaoErr = url.searchParams.get('error');
      if (kakaoErr) return errorRedirect(siteOrigin, url.searchParams.get('error_description') || kakaoErr);
      if (!code) return errorRedirect(siteOrigin, 'missing_code');

      // 1) Exchange code -> token
      const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: KAKAO_REST_API_KEY,
          client_secret: KAKAO_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          code,
        }),
      });
      if (!tokenRes.ok) {
        const t = await tokenRes.text();
        console.error('kakao token error', t);
        return errorRedirect(siteOrigin, 'kakao_token_failed');
      }
      const tokenJson = await tokenRes.json() as { access_token: string };

      // 2) Fetch Kakao user
      const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!meRes.ok) {
        const t = await meRes.text();
        console.error('kakao me error', t);
        return errorRedirect(siteOrigin, 'kakao_userinfo_failed');
      }
      const me = await meRes.json() as {
        id: number;
        kakao_account?: { email?: string; profile?: { nickname?: string } };
        properties?: { nickname?: string };
      };

      const kakaoId = String(me.id);
      const kakaoEmail = me.kakao_account?.email || null;
      const nickname = me.kakao_account?.profile?.nickname || me.properties?.nickname || '';

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

      // 3) Find existing profile by kakao_id (provider_user_id)
      let userId: string | null = null;
      const { data: existingByKakao } = await admin
        .from('profiles')
        .select('user_id')
        .eq('provider', 'kakao')
        .eq('provider_user_id', kakaoId)
        .maybeSingle();

      if (existingByKakao?.user_id) {
        userId = existingByKakao.user_id;
      } else if (kakaoEmail) {
        // Try linking by email if it's already in Auth (existing email signup or google login)
        const { data: existingByEmail } = await admin
          .from('profiles')
          .select('user_id, provider')
          .eq('email', kakaoEmail)
          .maybeSingle();

        if (existingByEmail?.user_id) {
          userId = existingByEmail.user_id;
          // Link kakao to existing account (only fill if currently null)
          await admin.from('profiles').update({
            provider_user_id: kakaoId,
          }).eq('user_id', userId).is('provider_user_id', null);
        }
      }

      // 4) Create new auth user if needed
      if (!userId) {
        // Use stable internal email for accounts without Kakao email permission
        const authEmail = kakaoEmail || `kakao_${kakaoId}@kakao.responser.local`;
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email: authEmail,
          email_confirm: true,
          user_metadata: {
            provider: 'kakao',
            provider_user_id: kakaoId,
            name: nickname,
            kakao_email_provided: !!kakaoEmail,
            ...(referralCode ? { referral_code: referralCode } : {}),
          },
        });
        if (createErr || !created.user) {
          console.error('createUser error', createErr);
          return errorRedirect(siteOrigin, 'create_user_failed');
        }
        userId = created.user.id;
        // handle_new_user trigger inserts profile with provider/provider_user_id from metadata.
      }

      // 5) Look up email for magic link issuance
      const { data: { user: authUser } } = await admin.auth.admin.getUserById(userId);
      const linkEmail = authUser?.email;
      if (!linkEmail) {
        return errorRedirect(siteOrigin, 'no_email_for_login');
      }

      // 6) Generate magic link → redirect browser to it (sets session, then to siteOrigin + redirectAfter)
      const target = `${siteOrigin}${redirectAfter}`;
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: linkEmail,
        options: { redirectTo: target },
      });
      if (linkErr || !linkData?.properties?.action_link) {
        console.error('generateLink error', linkErr);
        return errorRedirect(siteOrigin, 'session_link_failed');
      }
      return htmlRedirect(linkData.properties.action_link, '카카오 로그인 완료. 이동 중...');
    }

    return new Response('Unknown action', { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error('kakao-auth fatal', e);
    return new Response(`Server error: ${e?.message ?? 'unknown'}`, { status: 500, headers: corsHeaders });
  }
});

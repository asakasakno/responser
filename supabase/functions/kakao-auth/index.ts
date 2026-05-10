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

const DEFAULT_SITE_ORIGIN = 'https://xn--vk1booh7ruql6wa.com';

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
  return DEFAULT_SITE_ORIGIN;
}

function safeRedirect(url: string): Response {
  // Use a body-less HTTP 302 so HTML/script is never rendered and auth tokens
  // never appear in the response body. Content-Length guards against gateways
  // injecting fallback text for empty redirect responses.
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': url,
      'Cache-Control': 'no-store',
      'Content-Length': '0',
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

      return safeRedirect(authorize.toString());
    }

    if (action === 'callback') {
      const stateRaw = url.searchParams.get('state') || '';
      let siteOrigin = DEFAULT_SITE_ORIGIN;
      let redirectAfter = '/dashboard';
      let referralCode: string | undefined;
      let mode: 'login' | 'link' = 'login';
      let linkUserId: string | undefined;
      try {
        let payloadStr: string;
        let providedSig: string | null = null;
        if (stateRaw.includes('.')) {
          const [b64, sig] = stateRaw.split('.');
          providedSig = sig;
          const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
          payloadStr = atob(padded);
        } else {
          payloadStr = atob(stateRaw);
        }
        const parsed = JSON.parse(payloadStr);
        if (parsed?.o && ALLOWED_SITE_HOSTS.some((h) => new URL(parsed.o).hostname.endsWith(h))) {
          siteOrigin = parsed.o;
        }
        if (typeof parsed?.r === 'string' && parsed.r.startsWith('/')) redirectAfter = parsed.r;
        if (typeof parsed?.ref === 'string' && parsed.ref.length > 0 && parsed.ref.length < 32) referralCode = parsed.ref;
        if (parsed?.m === 'link' && typeof parsed?.u === 'string' && providedSig) {
          const key = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(KAKAO_CLIENT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
          );
          const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadStr));
          const expected = btoa(String.fromCharCode(...new Uint8Array(sig)))
            .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
          if (expected === providedSig && Date.now() - (parsed.t || 0) < 10 * 60 * 1000) {
            mode = 'link';
            linkUserId = parsed.u;
          }
        }
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

      // 2) Fetch Kakao user. Use POST with explicit property_keys to ensure
      //    kakao_account.email and related flags are returned reliably.
      const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenJson.access_token}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
        },
        body: new URLSearchParams({
          property_keys: JSON.stringify([
            'kakao_account.email',
            'kakao_account.profile',
            'kakao_account.has_email',
            'kakao_account.is_email_valid',
            'kakao_account.is_email_verified',
            'kakao_account.email_needs_agreement',
          ]),
        }),
      });
      if (!meRes.ok) {
        const t = await meRes.text();
        console.error('kakao me error', t);
        return errorRedirect(siteOrigin, 'kakao_userinfo_failed');
      }
      const me = await meRes.json() as {
        id: number;
        kakao_account?: {
          email?: string;
          has_email?: boolean;
          is_email_valid?: boolean;
          is_email_verified?: boolean;
          email_needs_agreement?: boolean;
          profile?: { nickname?: string };
        };
        properties?: { nickname?: string };
      };
      console.log('kakao me response', JSON.stringify({
        id: me.id,
        kakao_account: me.kakao_account ? {
          has_email: me.kakao_account.has_email,
          is_email_valid: me.kakao_account.is_email_valid,
          is_email_verified: me.kakao_account.is_email_verified,
          email_needs_agreement: me.kakao_account.email_needs_agreement,
          email_present: !!me.kakao_account.email,
        } : null,
      }));

      const kakaoId = String(me.id);
      const acc = me.kakao_account;
      // STRICT: only treat as a real email when Kakao explicitly confirms BOTH
      // is_email_verified === true AND is_email_valid === true. This prevents
      // unverified emails from auto-linking to existing accounts (esp. admins).
      const kakaoEmail = (
        acc?.email &&
        acc.email_needs_agreement !== true &&
        acc.has_email === true &&
        acc.is_email_valid === true &&
        acc.is_email_verified === true
      ) ? acc.email.toLowerCase() : null;
      const nickname = acc?.profile?.nickname || me.properties?.nickname || '';

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

      // ===== LINK MODE: attach kakao to currently signed-in user =====
      if (mode === 'link' && linkUserId) {
        // Email must be present, valid, verified, and consented
        if (!kakaoEmail) {
          return safeRedirect(`${siteOrigin}/settings?link_error=email_required`);
        }
        // Block if this kakao_id already belongs to a different user
        const { data: existing } = await admin
          .from('user_identity_links')
          .select('user_id')
          .eq('provider', 'kakao')
          .eq('provider_user_id', kakaoId)
          .eq('is_active', true)
          .maybeSingle();
        if (existing && existing.user_id !== linkUserId) {
          return safeRedirect(`${siteOrigin}/settings?link_error=already_linked`);
        }
        // For admin accounts, the email must match the account's email
        const { data: linkUser } = await admin.auth.admin.getUserById(linkUserId);
        const accountEmail = linkUser?.user?.email?.toLowerCase() ?? '';
        const { data: roleRow } = await admin.from('user_roles')
          .select('role').eq('user_id', linkUserId).eq('role', 'admin').maybeSingle();
        const isAdminAccount = !!roleRow;
        if (isAdminAccount && accountEmail !== kakaoEmail) {
          await admin.from('audit_logs').insert({
            user_id: linkUserId,
            action: 'identity_link_blocked',
            details: { provider: 'kakao', reason: 'admin_email_mismatch', kakao_email: kakaoEmail },
            severity: 'warning',
          });
          return safeRedirect(`${siteOrigin}/settings?link_error=admin_email_mismatch`);
        }

        // Deactivate any existing kakao link for this user, then insert new
        await admin.from('user_identity_links')
          .update({ is_active: false, unlinked_at: new Date().toISOString() })
          .eq('user_id', linkUserId).eq('provider', 'kakao').eq('is_active', true);

        const { error: insErr } = await admin.from('user_identity_links').insert({
          user_id: linkUserId,
          provider: 'kakao',
          provider_user_id: kakaoId,
          provider_email: kakaoEmail,
          email_verified: true,
          is_active: true,
        });
        if (insErr) {
          console.error('link insert error', insErr);
          return safeRedirect(`${siteOrigin}/settings?link_error=insert_failed`);
        }

        // Mirror provider_user_id into profiles only when not already taken
        await admin.from('profiles')
          .update({ provider_user_id: kakaoId })
          .eq('user_id', linkUserId)
          .is('provider_user_id', null);

        await admin.from('audit_logs').insert({
          user_id: linkUserId,
          action: 'identity_link_added',
          details: { provider: 'kakao', provider_email: kakaoEmail, is_admin_account: isAdminAccount },
          severity: isAdminAccount ? 'warning' : 'info',
        });
        return safeRedirect(`${siteOrigin}/settings?link=kakao_success`);
      }
      // ===== END LINK MODE =====


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
        // If we previously stored a placeholder email but Kakao now provides a real one, upgrade it.
        if (kakaoEmail) {
          const { data: { user: existingAuth } } = await admin.auth.admin.getUserById(userId);
          const currentEmail = existingAuth?.email ?? '';
          if (currentEmail.endsWith('@kakao.responser.local') && currentEmail !== kakaoEmail) {
            // Make sure the real email isn't already taken by someone else
            const { data: collide } = await admin
              .from('profiles')
              .select('user_id')
              .eq('email', kakaoEmail)
              .neq('user_id', userId)
              .maybeSingle();
            if (!collide) {
              const { error: upErr } = await admin.auth.admin.updateUserById(userId, {
                email: kakaoEmail, email_confirm: true,
              });
              if (!upErr) {
                await admin.from('profiles').update({ email: kakaoEmail }).eq('user_id', userId);
              } else {
                console.error('upgrade placeholder email failed', upErr);
              }
            }
          }
        }
      } else if (kakaoEmail) {
        // Try linking by email if it's already in Auth (existing email signup or google login)
        const { data: existingByEmail } = await admin
          .from('profiles')
          .select('user_id, provider')
          .eq('email', kakaoEmail)
          .maybeSingle();

        if (existingByEmail?.user_id) {
          // SECURITY: never auto-link a Kakao login to an account that holds the
          // admin role. This prevents privilege escalation via Kakao signup with
          // an admin's email address. Such linking must be performed manually.
          const { data: adminRole } = await admin
            .from('user_roles')
            .select('role')
            .eq('user_id', existingByEmail.user_id)
            .eq('role', 'admin')
            .maybeSingle();
          if (adminRole) {
            console.warn('blocked kakao auto-link to admin account', { email: kakaoEmail });
            return errorRedirect(siteOrigin, 'admin_link_blocked');
          }
          userId = existingByEmail.user_id;
          // Link kakao to existing account (only fill if currently null).
          // role/admin privileges are NEVER touched here.
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

      // Sync user_identity_links for kakao (idempotent upsert)
      try {
        const { data: existingLink } = await admin
          .from('user_identity_links')
          .select('id')
          .eq('user_id', userId)
          .eq('provider', 'kakao')
          .eq('is_active', true)
          .maybeSingle();
        if (!existingLink) {
          await admin.from('user_identity_links').insert({
            user_id: userId,
            provider: 'kakao',
            provider_user_id: kakaoId,
            provider_email: kakaoEmail,
            email_verified: !!kakaoEmail,
            is_active: true,
          });
        }
        if (kakaoEmail) {
          const { data: emailLink } = await admin
            .from('user_identity_links')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'email')
            .eq('is_active', true)
            .maybeSingle();
          if (!emailLink) {
            await admin.from('user_identity_links').insert({
              user_id: userId, provider: 'email', provider_email: kakaoEmail, email_verified: true, is_active: true,
            });
          }
        }
      } catch (e) { console.error('identity link sync failed', e); }

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
      return safeRedirect(linkData.properties.action_link);
    }

    return new Response('Unknown action', { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error('kakao-auth fatal', e);
    return new Response(`Server error: ${e?.message ?? 'unknown'}`, { status: 500, headers: corsHeaders });
  }
});

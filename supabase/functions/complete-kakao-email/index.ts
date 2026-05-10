// Allows a logged-in Kakao user (whose auth email is the internal placeholder
// `kakao_<id>@kakao.responser.local`) to set a real email address.
//
// Validates JWT, checks email isn't already used by another auth user, then
// updates auth.users.email + profiles.email via the admin API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PLACEHOLDER_DOMAIN = '@kakao.responser.local';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const { email } = await req.json().catch(() => ({} as any));
    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 200) {
      return new Response(JSON.stringify({ error: '유효한 이메일을 입력해주세요.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const newEmail = email.trim().toLowerCase();
    if (newEmail.endsWith(PLACEHOLDER_DOMAIN)) {
      return new Response(JSON.stringify({ error: '내부용 이메일은 사용할 수 없습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    // Verify caller is a kakao user with placeholder email
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('email, provider')
      .eq('user_id', userId)
      .maybeSingle();
    if (!callerProfile) {
      return new Response(JSON.stringify({ error: 'profile_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (callerProfile.provider !== 'kakao' || !callerProfile.email?.endsWith(PLACEHOLDER_DOMAIN)) {
      return new Response(JSON.stringify({ error: '이미 이메일이 등록되어 있습니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check email collision in profiles (covers email + google + other kakao)
    const { data: collide } = await admin
      .from('profiles')
      .select('user_id')
      .eq('email', newEmail)
      .neq('user_id', userId)
      .maybeSingle();
    if (collide) {
      return new Response(JSON.stringify({ error: '이미 다른 계정에서 사용 중인 이메일입니다.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update auth user email (confirm immediately; user already verified via Kakao OAuth)
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });
    if (updErr) {
      console.error('updateUserById error', updErr);
      const msg = /already been registered|duplicate/i.test(updErr.message)
        ? '이미 다른 계정에서 사용 중인 이메일입니다.'
        : '이메일 업데이트 실패';
      return new Response(JSON.stringify({ error: msg }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await admin.from('profiles').update({ email: newEmail }).eq('user_id', userId);

    return new Response(JSON.stringify({ success: true, email: newEmail }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('complete-kakao-email fatal', e);
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

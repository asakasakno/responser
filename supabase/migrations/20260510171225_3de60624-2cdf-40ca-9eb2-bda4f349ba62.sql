-- Add provider tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS provider_user_id text;

CREATE INDEX IF NOT EXISTS profiles_provider_user_id_idx
  ON public.profiles(provider, provider_user_id)
  WHERE provider_user_id IS NOT NULL;

-- Harden the profiles UPDATE policy: users can't change provider/provider_user_id/suspended
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND suspended = (SELECT p.suspended FROM profiles p WHERE p.user_id = auth.uid())
  AND provider = (SELECT p.provider FROM profiles p WHERE p.user_id = auth.uid())
  AND provider_user_id IS NOT DISTINCT FROM (SELECT p.provider_user_id FROM profiles p WHERE p.user_id = auth.uid())
);

-- Update handle_new_user to capture social login metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _referral_code text;
  _ref_input text;
  _referrer_id uuid;
  _provider text;
  _provider_user_id text;
  _name text;
  _company text;
  _phone text;
BEGIN
  _referral_code := LOWER(SUBSTRING(MD5(RANDOM()::text || NEW.id::text) FROM 1 FOR 8));

  _provider := COALESCE(NEW.raw_user_meta_data->>'provider', 'email');
  _provider_user_id := NEW.raw_user_meta_data->>'provider_user_id';
  _name := NEW.raw_user_meta_data->>'name';
  _company := NEW.raw_user_meta_data->>'company_name';
  _phone := NEW.raw_user_meta_data->>'phone';

  INSERT INTO public.profiles (user_id, email, energy_balance, max_energy, referral_code, provider, provider_user_id, name, company_name, phone)
  VALUES (NEW.id, NEW.email, 0, 100, _referral_code, _provider, _provider_user_id, _name, _company, _phone);

  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');

  PERFORM earn_energy(NEW.id, 20, 'signup', '회원가입 보상', 'signup', NULL);

  _ref_input := NEW.raw_user_meta_data->>'referral_code';
  IF _ref_input IS NOT NULL AND LENGTH(_ref_input) > 0 THEN
    SELECT user_id INTO _referrer_id FROM profiles WHERE referral_code = LOWER(_ref_input) AND user_id <> NEW.id;
    IF _referrer_id IS NOT NULL THEN
      INSERT INTO referrals (referrer_id, referred_user_id, status, reward_given, completed_at)
      VALUES (_referrer_id, NEW.id, 'completed', true, now());
      PERFORM earn_energy(_referrer_id, 100, 'referral_referrer', '주변 사장님 추천 보상', 'referral', NULL);
      PERFORM earn_energy(NEW.id, 50, 'referral_friend', '추천 가입 보상', 'referral', NULL);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Add energy columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN energy_balance integer NOT NULL DEFAULT 20,
ADD COLUMN max_energy integer NOT NULL DEFAULT 100,
ADD COLUMN referral_code text UNIQUE DEFAULT NULL;

-- Generate referral codes for existing users
UPDATE public.profiles SET referral_code = LOWER(SUBSTRING(MD5(RANDOM()::text || id::text) FROM 1 FOR 8)) WHERE referral_code IS NULL;

-- Create energy_transactions table
CREATE TABLE public.energy_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('earn', 'spend')),
  amount integer NOT NULL,
  reason text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.energy_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
ON public.energy_transactions FOR SELECT
USING (auth.uid() = user_id);

CREATE INDEX idx_energy_transactions_user ON public.energy_transactions(user_id, created_at DESC);

-- Create referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  reward_given boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(referred_user_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals as referrer"
ON public.referrals FOR SELECT
USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view own referrals as referred"
ON public.referrals FOR SELECT
USING (auth.uid() = referred_user_id);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);

-- Create spend_energy function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.spend_energy(_amount integer, _reason text, _description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance integer;
  _user_id uuid := auth.uid();
BEGIN
  SELECT energy_balance INTO _balance FROM profiles WHERE user_id = _user_id FOR UPDATE;
  
  IF _balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF _balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient energy', 'balance', _balance);
  END IF;
  
  UPDATE profiles SET energy_balance = energy_balance - _amount WHERE user_id = _user_id;
  
  INSERT INTO energy_transactions (user_id, type, amount, reason, description)
  VALUES (_user_id, 'spend', _amount, _reason, _description);
  
  RETURN jsonb_build_object('success', true, 'balance', _balance - _amount, 'spent', _amount);
END;
$$;

-- Create earn_energy function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.earn_energy(_user_id uuid, _amount integer, _reason text, _description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance integer;
  _max integer;
  _actual_amount integer;
BEGIN
  SELECT energy_balance, max_energy INTO _balance, _max FROM profiles WHERE user_id = _user_id FOR UPDATE;
  
  IF _balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  _actual_amount := LEAST(_amount, _max - _balance);
  IF _actual_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Energy at max capacity', 'balance', _balance);
  END IF;
  
  UPDATE profiles SET energy_balance = energy_balance + _actual_amount WHERE user_id = _user_id;
  
  INSERT INTO energy_transactions (user_id, type, amount, reason, description)
  VALUES (_user_id, 'earn', _actual_amount, _reason, _description);
  
  RETURN jsonb_build_object('success', true, 'balance', _balance + _actual_amount, 'earned', _actual_amount);
END;
$$;

-- Update handle_new_user to include energy and referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _referral_code text;
BEGIN
  _referral_code := LOWER(SUBSTRING(MD5(RANDOM()::text || NEW.id::text) FROM 1 FOR 8));
  
  INSERT INTO public.profiles (user_id, email, energy_balance, max_energy, referral_code)
  VALUES (NEW.id, NEW.email, 20, 100, _referral_code);
  
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');
  
  -- Record signup energy reward
  INSERT INTO public.energy_transactions (user_id, type, amount, reason, description)
  VALUES (NEW.id, 'earn', 20, 'signup', '회원가입 보상');
  
  RETURN NEW;
END;
$$;

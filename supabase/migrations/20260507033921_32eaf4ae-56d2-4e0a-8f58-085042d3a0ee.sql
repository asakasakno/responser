
-- =========================================
-- CTA 링크 (예약/오픈채팅/쿠폰/전화)
-- =========================================
CREATE TABLE public.cta_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('reserve','chat','coupon','call','custom')),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  url text NOT NULL CHECK (length(url) BETWEEN 1 AND 500),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cta_links_user_idx ON public.cta_links(user_id);
ALTER TABLE public.cta_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own cta_links" ON public.cta_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own cta_links" ON public.cta_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own cta_links" ON public.cta_links
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own cta_links" ON public.cta_links
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cta_links_updated
  BEFORE UPDATE ON public.cta_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 내 말투 학습 샘플 (few-shot)
-- =========================================
CREATE TABLE public.user_voice_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (length(content) BETWEEN 5 AND 1000),
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_voice_samples_user_idx ON public.user_voice_samples(user_id);
ALTER TABLE public.user_voice_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own voice_samples" ON public.user_voice_samples
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own voice_samples" ON public.user_voice_samples
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own voice_samples" ON public.user_voice_samples
  FOR DELETE USING (auth.uid() = user_id);

-- =========================================
-- CS FAQ 자동 응답
-- =========================================
CREATE TABLE public.cs_faq_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text,
  keywords text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL CHECK (length(answer) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cs_faq_entries_user_idx ON public.cs_faq_entries(user_id);
ALTER TABLE public.cs_faq_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own faq" ON public.cs_faq_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own faq" ON public.cs_faq_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own faq" ON public.cs_faq_entries
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own faq" ON public.cs_faq_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER cs_faq_entries_updated
  BEFORE UPDATE ON public.cs_faq_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

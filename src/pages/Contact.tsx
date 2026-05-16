import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, MessageCircle, ArrowLeft, Mail, Phone } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';

const KAKAO_URL = 'http://pf.kakao.com/_vXYTX';

const inquirySchema = z.object({
  name: z.string().trim().min(1, '이름을 입력해주세요').max(100),
  email: z.string().trim().email('올바른 이메일을 입력해주세요').max(255),
  subject: z.string().trim().min(1, '제목을 입력해주세요').max(200),
  message: z.string().trim().min(10, '문의 내용을 10자 이상 입력해주세요').max(5000),
});

export default function Contact() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.title = '문의하기 | 응대도우미';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', '응대도우미 문의하기 페이지. 카카오톡 채널 또는 문의 폼으로 빠르게 답변드립니다.');
  }, []);

  useEffect(() => {
    if (user?.email && !form.email) {
      setForm((f) => ({ ...f, email: user.email ?? '' }));
    }
  }, [user, form.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const parsed = inquirySchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('contact_inquiries').insert({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
      user_id: user?.id,
    });
    setSubmitting(false);

    if (error) {
      if (import.meta.env.DEV) console.error('[contact-submit]', error);
      const msg = /rate_limited|too many/i.test(error.message ?? '')
        ? '같은 이메일로 너무 많은 문의를 보냈습니다. 잠시 후 다시 시도해주세요.'
        : '전송에 실패했습니다. 잠시 후 다시 시도해주세요.';
      toast({ title: '전송 실패', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: '문의가 접수되었습니다', description: '빠른 시일 내에 답변드리겠습니다.' });
    setForm({ name: '', email: user?.email ?? '', subject: '', message: '' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground">응대도우미</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" />홈으로</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-10 max-w-3xl">
        <div className="text-center mb-10 space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">문의하기</h1>
          <p className="text-muted-foreground">궁금한 점이나 요청사항을 알려주세요. 평일 10:00 ~ 18:00 내 답변드립니다.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <a href={KAKAO_URL} target="_blank" rel="noopener noreferrer">
            <Card className="hover:border-primary/50 transition-colors h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-yellow-400 flex items-center justify-center mb-2">
                  <MessageCircle className="w-5 h-5 text-yellow-900" />
                </div>
                <CardTitle className="text-base">카카오톡 채널</CardTitle>
                <CardDescription>가장 빠른 응대 (실시간)</CardDescription>
              </CardHeader>
            </Card>
          </a>
          <a href="mailto:support@응대도우미.com">
            <Card className="hover:border-primary/50 transition-colors h-full">
              <CardHeader>
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-base">이메일</CardTitle>
                <CardDescription>support@응대도우미.com</CardDescription>
              </CardHeader>
            </Card>
          </a>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>문의 폼</CardTitle>
            <CardDescription>아래 폼을 작성해주시면 등록하신 이메일로 회신드립니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">이름 *</Label>
                  <Input id="name" value={form.name} maxLength={100}
                    onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">이메일 *</Label>
                  <Input id="email" type="email" value={form.email} maxLength={255}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">제목 *</Label>
                <Input id="subject" value={form.subject} maxLength={200}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">내용 *</Label>
                <Textarea id="message" rows={6} value={form.message} maxLength={5000}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder="문의하실 내용을 자세히 적어주세요 (10자 이상)" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  {errors.message ? <span className="text-destructive">{errors.message}</span> : <span />}
                  <span>{form.message.length} / 5000</span>
                </div>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? '전송 중...' : '문의 보내기'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Phone className="w-3 h-3" />
          <a href="tel:01050979549" className="hover:text-foreground">010-5097-9549</a>
          <span>(평일 10:00 ~ 18:00)</span>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Plus } from 'lucide-react';
import { CTA_KINDS, type CtaKind, type CtaLink, type VoiceSample } from '@/types';

export default function ResponseSettings() {
  const { user, plan } = useAuth();
  const { toast } = useToast();

  const [ctas, setCtas] = useState<CtaLink[]>([]);
  const [ctaKind, setCtaKind] = useState<CtaKind>('reserve');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');

  const [voice, setVoice] = useState<VoiceSample[]>([]);
  const [voiceContent, setVoiceContent] = useState('');

  const [faqs, setFaqs] = useState<any[]>([]);
  const [faqKeywords, setFaqKeywords] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  const isPaid = plan !== 'free';

  const reload = async () => {
    if (!user) return;
    const [c, v, f] = await Promise.all([
      supabase.from('cta_links').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('user_voice_samples').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('cs_faq_entries').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);
    setCtas((c.data as any) || []);
    setVoice((v.data as any) || []);
    setFaqs((f.data as any) || []);
  };

  useEffect(() => { reload(); }, [user]);

  const addCta = async () => {
    if (!ctaLabel.trim() || !ctaUrl.trim()) return;
    if (!/^https?:\/\//.test(ctaUrl.trim())) {
      toast({ title: 'URL은 http(s)://로 시작해야 합니다.', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('cta_links').insert({
      user_id: user!.id, kind: ctaKind, label: ctaLabel.trim().slice(0, 30), url: ctaUrl.trim().slice(0, 200),
    });
    if (error) toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    else { setCtaLabel(''); setCtaUrl(''); reload(); }
  };

  const delCta = async (id: string) => {
    await supabase.from('cta_links').delete().eq('id', id);
    reload();
  };

  const setDefaultCta = async (id: string) => {
    await supabase.from('cta_links').update({ is_default: false }).eq('user_id', user!.id);
    await supabase.from('cta_links').update({ is_default: true }).eq('id', id);
    reload();
  };

  const addVoice = async () => {
    if (!voiceContent.trim()) return;
    if (voice.length >= 5) { toast({ title: '샘플은 최대 5개까지 등록할 수 있습니다.', variant: 'destructive' }); return; }
    const { error } = await supabase.from('user_voice_samples').insert({
      user_id: user!.id, content: voiceContent.trim().slice(0, 500),
    });
    if (error) toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    else { setVoiceContent(''); reload(); }
  };

  const delVoice = async (id: string) => {
    await supabase.from('user_voice_samples').delete().eq('id', id);
    reload();
  };

  const addFaq = async () => {
    const kws = faqKeywords.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
    if (kws.length === 0 || !faqAnswer.trim()) return;
    const { error } = await supabase.from('cs_faq_entries').insert({
      user_id: user!.id, keywords: kws, answer: faqAnswer.trim().slice(0, 500),
    });
    if (error) toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    else { setFaqKeywords(''); setFaqAnswer(''); reload(); }
  };

  const delFaq = async (id: string) => {
    await supabase.from('cs_faq_entries').delete().eq('id', id);
    reload();
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-foreground">응대 운영 설정</h1>
        <p className="text-sm text-muted-foreground mb-6">CTA 링크, 사장님 말투 학습, FAQ를 관리하세요.</p>
        {!isPaid && (
          <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            유료 플랜에서 답변 생성 시 자동으로 적용됩니다.
          </div>
        )}

        <Tabs defaultValue="cta">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="cta">CTA 링크</TabsTrigger>
            <TabsTrigger value="voice">사장님 말투 ({voice.length}/5)</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
          </TabsList>

          <TabsContent value="cta" className="space-y-3 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={ctaKind} onValueChange={(v) => setCtaKind(v as CtaKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CTA_KINDS.map(k => <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input placeholder="버튼 텍스트 (예: 예약하기)" value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} maxLength={30} />
              <Input placeholder="https://..." value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} maxLength={200} />
            </div>
            <Button onClick={addCta}><Plus className="w-4 h-4 mr-1" />추가</Button>
            <div className="space-y-2">
              {ctas.map(c => (
                <div key={c.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground">{c.label} <span className="text-xs text-muted-foreground">[{c.kind}]</span></div>
                    <div className="text-xs text-muted-foreground truncate">{c.url}</div>
                  </div>
                  <div className="flex gap-2">
                    {!c.is_default && <Button size="sm" variant="outline" onClick={() => setDefaultCta(c.id)}>기본설정</Button>}
                    {c.is_default && <span className="text-xs text-primary px-2 py-1">기본</span>}
                    <Button size="sm" variant="ghost" onClick={() => delCta(c.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">평소 답변 예시 3~5개를 등록하면 답변이 사장님 말투로 생성됩니다.</p>
            <Textarea value={voiceContent} onChange={e => setVoiceContent(e.target.value)} rows={3} maxLength={500} placeholder="평소 사용하시는 답변 예시를 그대로 붙여넣으세요." />
            <Button onClick={addVoice} disabled={voice.length >= 5}><Plus className="w-4 h-4 mr-1" />샘플 추가</Button>
            <div className="space-y-2">
              {voice.map(v => (
                <div key={v.id} className="flex items-start gap-2 border rounded-lg p-3 text-sm">
                  <p className="flex-1 whitespace-pre-wrap text-foreground">{v.content}</p>
                  <Button size="sm" variant="ghost" onClick={() => delVoice(v.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="faq" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">자주 오는 문의의 키워드와 정형 답변을 등록해 두면 응대를 빠르게 처리할 수 있어요.</p>
            <Input placeholder="키워드 (쉼표로 구분, 예: 영업시간, 운영시간)" value={faqKeywords} onChange={e => setFaqKeywords(e.target.value)} />
            <Textarea value={faqAnswer} onChange={e => setFaqAnswer(e.target.value)} rows={3} maxLength={500} placeholder="정형 답변 내용" />
            <Button onClick={addFaq}><Plus className="w-4 h-4 mr-1" />FAQ 추가</Button>
            <div className="space-y-2">
              {faqs.map(f => (
                <div key={f.id} className="flex items-start gap-2 border rounded-lg p-3 text-sm">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground mb-1">키워드: {(f.keywords || []).join(', ')}</div>
                    <p className="whitespace-pre-wrap text-foreground">{f.answer}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => delFaq(f.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

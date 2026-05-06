import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Trash2, BookmarkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type GenType = 'review' | 'inquiry' | 'claim';
interface Template {
  id: string;
  title: string;
  type: GenType;
  content: string;
  created_at: string;
}

const TYPE_LABELS: Record<GenType, string> = { review: '리뷰', inquiry: '문의', claim: '클레임' };

export default function Templates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | GenType>('all');

  const load = () => {
    if (!user) return;
    setLoading(true);
    supabase.from('user_templates')
      .select('id, title, type, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems((data || []) as Template[]);
        setLoading(false);
      });
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const filtered = useMemo(() => items.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.content.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, search, typeFilter]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '복사됨 (에너지 차감 없음)' });
  };

  const remove = async (id: string) => {
    if (!confirm('템플릿을 삭제할까요?')) return;
    const { error } = await supabase.from('user_templates').delete().eq('id', id);
    if (error) toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    else { toast({ title: '삭제됨' }); setItems(prev => prev.filter(t => t.id !== id)); }
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-2">내 템플릿</h1>
        <p className="text-sm text-muted-foreground mb-6">자주 쓰는 답변을 저장하고 에너지 차감 없이 바로 복사하세요.</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <Input placeholder="제목/내용 검색" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[160px]" />
          <div className="flex gap-1">
            {(['all','review','inquiry','claim'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full border text-sm ${typeFilter===t ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground'}`}>
                {t==='all' ? '전체' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <BookmarkIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">저장된 템플릿이 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">답변 생성 후 "템플릿 저장"을 눌러 저장할 수 있습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <div key={t.id} className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{TYPE_LABELS[t.type]}</span>
                    <h3 className="font-semibold text-foreground truncate">{t.title}</h3>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => copy(t.content)}><Copy className="w-3.5 h-3.5 mr-1" /> 복사</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(t.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{t.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

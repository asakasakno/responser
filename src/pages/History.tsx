import { useState, useEffect, useMemo } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, History as HistoryIcon, Star, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type GenType = 'review' | 'inquiry' | 'claim';

interface Generation {
  id: string;
  type: GenType;
  input_text: string;
  output_text: string;
  is_favorite: boolean;
  created_at: string;
}

const TYPE_LABELS: Record<GenType, string> = { review: '리뷰', inquiry: '문의', claim: '클레임' };
const TYPE_COLORS: Record<GenType, string> = { review: 'bg-primary/10 text-primary', inquiry: 'bg-accent/10 text-accent', claim: 'bg-destructive/10 text-destructive' };

export default function History() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | GenType>('all');
  const [favOnly, setFavOnly] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('generations')
      .select('id, type, input_text, output_text, is_favorite, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setGenerations((data || []) as Generation[]);
        setLoading(false);
      });
  }, [user]);

  const filtered = useMemo(() => {
    return generations.filter(g => {
      if (typeFilter !== 'all' && g.type !== typeFilter) return false;
      if (favOnly && !g.is_favorite) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!g.input_text.toLowerCase().includes(q) && !g.output_text.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [generations, search, typeFilter, favOnly]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '복사됨' });
  };

  const toggleFavorite = async (g: Generation) => {
    const next = !g.is_favorite;
    setGenerations(prev => prev.map(x => x.id === g.id ? { ...x, is_favorite: next } : x));
    const { error } = await supabase.from('generations').update({ is_favorite: next }).eq('id', g.id);
    if (error) {
      toast({ title: '실패', description: error.message, variant: 'destructive' });
      setGenerations(prev => prev.map(x => x.id === g.id ? { ...x, is_favorite: !next } : x));
    }
  };

  const saveAsTemplate = async (g: Generation) => {
    const title = window.prompt('템플릿 제목', `${TYPE_LABELS[g.type]} 템플릿`);
    if (!title?.trim()) return;
    const { error } = await supabase.from('user_templates').insert({
      user_id: user!.id, title: title.trim().slice(0, 100), type: g.type, content: g.output_text,
    });
    if (error) toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    else toast({ title: '템플릿으로 저장됨' });
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">생성 기록</h1>

        <div className="flex flex-wrap gap-2 mb-4">
          <Input placeholder="검색 (입력/답변 키워드)" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 min-w-[160px]" />
          <div className="flex gap-1">
            {(['all','review','inquiry','claim'] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full border text-sm ${typeFilter===t ? 'border-primary bg-primary/10' : 'border-border text-muted-foreground'}`}>
                {t==='all' ? '전체' : TYPE_LABELS[t]}
              </button>
            ))}
            <button onClick={() => setFavOnly(v=>!v)}
              className={`px-3 py-1.5 rounded-full border text-sm flex items-center gap-1 ${favOnly ? 'border-yellow-500 bg-yellow-500/10' : 'border-border text-muted-foreground'}`}>
              <Star className="w-3.5 h-3.5" /> 즐겨찾기
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <HistoryIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">조건에 맞는 기록이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(g => (
              <div key={g.id} className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[g.type]}`}>
                      {TYPE_LABELS[g.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(g.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggleFavorite(g)}>
                      <Star className={`w-4 h-4 ${g.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => saveAsTemplate(g)}>
                      <Save className="w-3.5 h-3.5 mr-1" /> 템플릿
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => copy(g.output_text)}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> 복사
                    </Button>
                  </div>
                </div>
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1">입력</p>
                  <p className="text-sm text-foreground line-clamp-2">{g.input_text}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">생성된 답변</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{g.output_text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

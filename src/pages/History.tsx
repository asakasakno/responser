import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Copy, History as HistoryIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type GenType = 'review' | 'inquiry' | 'claim';

interface Generation {
  id: string;
  type: GenType;
  input_text: string;
  output_text: string;
  created_at: string;
}

const TYPE_LABELS: Record<GenType, string> = { review: '리뷰', inquiry: '문의', claim: '클레임' };
const TYPE_COLORS: Record<GenType, string> = { review: 'bg-primary/10 text-primary', inquiry: 'bg-accent/10 text-accent', claim: 'bg-destructive/10 text-destructive' };

export default function History() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('generations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setGenerations((data || []) as Generation[]);
        setLoading(false);
      });
  }, [user]);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '복사됨' });
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">생성 기록</h1>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : generations.length === 0 ? (
          <div className="text-center py-16">
            <HistoryIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">아직 생성 기록이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {generations.map(g => (
              <div key={g.id} className="bg-card rounded-xl border border-border p-5 shadow-card">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[g.type]}`}>
                      {TYPE_LABELS[g.type]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(g.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copy(g.output_text)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> 복사
                  </Button>
                </div>
                <div className="mb-2">
                  <p className="text-xs text-muted-foreground mb-1">입력</p>
                  <p className="text-sm text-foreground line-clamp-2">{g.input_text}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">생성된 답변</p>
                  <p className="text-sm text-foreground line-clamp-3">{g.output_text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

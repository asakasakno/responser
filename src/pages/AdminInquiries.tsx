import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminGuard from '@/components/admin/AdminGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Mail, Clock, CheckCircle2, Trash2 } from 'lucide-react';

interface Inquiry {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

export default function AdminInquiries() {
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');

  useEffect(() => { document.title = '문의 관리 | 관리자'; load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: '불러오기 실패', description: error.message, variant: 'destructive' });
      return;
    }
    setInquiries((data ?? []) as Inquiry[]);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('contact_inquiries').update({ status }).eq('id', id);
    if (error) { toast({ title: '실패', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '상태가 변경되었습니다' });
    load();
  };

  const saveNote = async (id: string, admin_note: string) => {
    const { error } = await supabase.from('contact_inquiries').update({ admin_note }).eq('id', id);
    if (error) { toast({ title: '실패', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '메모가 저장되었습니다' });
  };

  const remove = async (id: string) => {
    if (!confirm('이 문의를 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('contact_inquiries').delete().eq('id', id);
    if (error) { toast({ title: '실패', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '삭제되었습니다' });
    load();
  };

  const filtered = inquiries.filter((i) => filter === 'all' || i.status === filter);

  return (
    <AdminGuard>
      <AdminLayout>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">문의 관리</h1>
              <p className="text-sm text-muted-foreground mt-1">총 {inquiries.length}건 · 미처리 {inquiries.filter(i => i.status === 'open').length}건</p>
            </div>
            <div className="flex gap-1">
              {(['all', 'open', 'resolved'] as const).map((s) => (
                <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'} onClick={() => setFilter(s)}>
                  {s === 'all' ? '전체' : s === 'open' ? '미처리' : '처리됨'}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">문의가 없습니다.</CardContent></Card>
          ) : (
            filtered.map((i) => <InquiryCard key={i.id} inquiry={i} onStatus={updateStatus} onSaveNote={saveNote} onDelete={remove} />)
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}

function InquiryCard({ inquiry, onStatus, onSaveNote, onDelete }: {
  inquiry: Inquiry;
  onStatus: (id: string, s: string) => void;
  onSaveNote: (id: string, n: string) => void;
  onDelete: (id: string) => void;
}) {
  const [note, setNote] = useState(inquiry.admin_note ?? '');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{inquiry.subject}</CardTitle>
              <Badge variant={inquiry.status === 'open' ? 'destructive' : 'secondary'}>
                {inquiry.status === 'open' ? '미처리' : '처리됨'}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
              <span>{inquiry.name}</span>
              <a href={`mailto:${inquiry.email}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="w-3 h-3" />{inquiry.email}
              </a>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{new Date(inquiry.created_at).toLocaleString('ko-KR')}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-3 border border-border">
          {inquiry.message}
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">관리자 메모</label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="내부 메모..." />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onSaveNote(inquiry.id, note)}>메모 저장</Button>
          {inquiry.status === 'open' ? (
            <Button size="sm" onClick={() => onStatus(inquiry.id, 'resolved')}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />처리 완료
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onStatus(inquiry.id, 'open')}>다시 열기</Button>
          )}
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onDelete(inquiry.id)}>
            <Trash2 className="w-3.5 h-3.5 mr-1" />삭제
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

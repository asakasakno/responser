import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Row {
  id: string;
  user_id: string;
  type: string;
  platform: string | null;
  business_category: string | null;
  sub_category: string | null;
  tone: string | null;
  rating: number | null;
  original_review: string | null;
  generated_reply: string;
  final_reply: string | null;
  copied: boolean;
  edited: boolean;
  feedback: string | null;
  created_at: string;
}

export default function AdminGenerationFeedback() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [platform, setPlatform] = useState('all');
  const [business, setBusiness] = useState('all');
  const [tone, setTone] = useState('all');
  const [feedback, setFeedback] = useState('all');
  const [search, setSearch] = useState('');

  // Aggregations
  const [stats, setStats] = useState({ total: 0, like: 0, dislike: 0, edited: 0, copied: 0 });

  const load = async () => {
    setLoading(true);
    let q = supabase.from('generation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (platform !== 'all') q = q.eq('platform', platform);
    if (business !== 'all') q = q.eq('business_category', business);
    if (tone !== 'all') q = q.eq('tone', tone);
    if (feedback !== 'all') q = q.eq('feedback', feedback);
    const { data, error } = await q;
    if (!error && data) {
      const filtered = search
        ? (data as Row[]).filter(r =>
            (r.original_review || '').includes(search) ||
            r.generated_reply.includes(search) ||
            (r.final_reply || '').includes(search))
        : (data as Row[]);
      setRows(filtered);
      const s = { total: filtered.length, like: 0, dislike: 0, edited: 0, copied: 0 };
      filtered.forEach(r => {
        if (r.feedback === 'like') s.like++;
        if (r.feedback === 'dislike') s.dislike++;
        if (r.edited) s.edited++;
        if (r.copied) s.copied++;
      });
      setStats(s);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [platform, business, tone, feedback]);

  // Distinct option lists from current rows
  const distinct = (key: keyof Row) =>
    Array.from(new Set(rows.map(r => r[key]).filter(Boolean))) as string[];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">답변 품질 / 피드백</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">전체</div><div className="text-2xl font-bold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">👍 좋아요</div><div className="text-2xl font-bold text-green-600">{stats.like}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">👎 별로</div><div className="text-2xl font-bold text-red-600">{stats.dislike}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">✏️ 수정</div><div className="text-2xl font-bold text-amber-600">{stats.edited}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">📋 복사</div><div className="text-2xl font-bold text-blue-600">{stats.copied}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap gap-2">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="플랫폼" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 플랫폼</SelectItem>
                {['naver_smartstore','coupang','baemin','yogiyo','airbnb','yanolja','goodchoice','other'].map(p =>
                  <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={business} onValueChange={setBusiness}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="업종" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 업종</SelectItem>
                {distinct('business_category').map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="톤" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 톤</SelectItem>
                {distinct('tone').map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={feedback} onValueChange={setFeedback}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="피드백" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 피드백</SelectItem>
                <SelectItem value="like">좋아요</SelectItem>
                <SelectItem value="dislike">별로예요</SelectItem>
                <SelectItem value="edited">수정함</SelectItem>
              </SelectContent>
            </Select>
            <Input className="max-w-xs" placeholder="원문/답변 검색"
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()} />
            <Button variant="outline" onClick={load} disabled={loading}>{loading ? '...' : '새로고침'}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시각</TableHead>
                  <TableHead>플랫폼</TableHead>
                  <TableHead>업종</TableHead>
                  <TableHead>톤</TableHead>
                  <TableHead>★</TableHead>
                  <TableHead>원문(마스킹)</TableHead>
                  <TableHead>생성 답변</TableHead>
                  <TableHead>수정본</TableHead>
                  <TableHead>피드백</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString('ko-KR')}</TableCell>
                    <TableCell className="text-xs">{r.platform || '-'}</TableCell>
                    <TableCell className="text-xs">{r.business_category || '-'}{r.sub_category ? ` / ${r.sub_category}` : ''}</TableCell>
                    <TableCell className="text-xs">{r.tone || '-'}</TableCell>
                    <TableCell className="text-xs">{r.rating ?? '-'}</TableCell>
                    <TableCell className="text-xs max-w-xs"><div className="line-clamp-3 whitespace-pre-wrap">{r.original_review || '-'}</div></TableCell>
                    <TableCell className="text-xs max-w-xs"><div className="line-clamp-3 whitespace-pre-wrap">{r.generated_reply}</div></TableCell>
                    <TableCell className="text-xs max-w-xs"><div className="line-clamp-3 whitespace-pre-wrap text-amber-700">{r.final_reply || '-'}</div></TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col gap-1">
                        {r.feedback === 'like' && <Badge className="bg-green-100 text-green-800 border-0">👍 좋아요</Badge>}
                        {r.feedback === 'dislike' && <Badge className="bg-red-100 text-red-800 border-0">👎 별로</Badge>}
                        {r.feedback === 'edited' && <Badge className="bg-amber-100 text-amber-800 border-0">✏️ 수정</Badge>}
                        {r.copied && <Badge variant="outline" className="text-[10px]">복사됨</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">데이터가 없습니다.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  logId: string | null;
  initialReply: string;
  onEditedReplyChange?: (text: string) => void;
}

type Feedback = 'like' | 'dislike' | 'edited' | null;

export default function FeedbackBar({ logId, initialReply, onEditedReplyChange }: Props) {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialReply);
  const [busy, setBusy] = useState(false);

  if (!logId) return null;

  const sendFeedback = async (value: Exclude<Feedback, null>) => {
    if (busy) return;
    setBusy(true);
    setFeedback(value);
    try {
      const { error } = await supabase
        .from('generation_logs')
        .update({ feedback: value })
        .eq('id', logId);
      if (error) throw error;
      toast({ title: '피드백 감사합니다!' });
    } catch (e: any) {
      toast({ title: '저장 실패', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('generation_logs')
        .update({ final_reply: draft, edited: true, feedback: 'edited' })
        .eq('id', logId);
      if (error) throw error;
      setFeedback('edited');
      setEditing(false);
      onEditedReplyChange?.(draft);
      toast({ title: '수정본이 저장되었습니다.' });
    } catch (e: any) {
      toast({ title: '저장 실패', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      {editing ? (
        <div className="space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={busy}>
              <Check className="w-3.5 h-3.5 mr-1" /> 저장
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(initialReply); }}>
              <X className="w-3.5 h-3.5 mr-1" /> 취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">이 답변 어땠나요?</span>
          <Button
            size="sm"
            variant={feedback === 'like' ? 'default' : 'outline'}
            onClick={() => sendFeedback('like')}
            disabled={busy}
          >
            <ThumbsUp className="w-3.5 h-3.5 mr-1" /> 마음에 들어요
          </Button>
          <Button
            size="sm"
            variant={feedback === 'dislike' ? 'default' : 'outline'}
            onClick={() => sendFeedback('dislike')}
            disabled={busy}
          >
            <ThumbsDown className="w-3.5 h-3.5 mr-1" /> 별로예요
          </Button>
          <Button
            size="sm"
            variant={feedback === 'edited' ? 'default' : 'outline'}
            onClick={() => setEditing(true)}
            disabled={busy}
          >
            <Pencil className="w-3.5 h-3.5 mr-1" /> 수정해서 사용
          </Button>
        </div>
      )}
    </div>
  );
}

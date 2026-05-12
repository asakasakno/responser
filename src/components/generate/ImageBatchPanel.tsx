import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, X, Copy, Loader2, AlertTriangle, RefreshCw, Wand2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { compressImageFile } from '@/lib/imageCompress';
import { maskPII } from '@/lib/masking';
import FeedbackBar from './FeedbackBar';
import SmoothProgress from './SmoothProgress';

export type GenType = 'review' | 'inquiry' | 'claim';

export interface BatchJobContext {
  userId: string;
  type: GenType;
  energyCost: number;
  productId: string | null;
  productCtx: { id: string; name: string; category: string; note: string | null } | null;
  platformPayload: { id: string; label: string } | undefined;
  businessCategory: string | null;
  subCategory: string | null;
  tone: string | null;
  rating: number | null;
  extraPayload: Record<string, any>;
}

export const MAX_QUEUE = 10;
const OCR_CONCURRENCY = 3;
const GEN_CONCURRENCY = 2;

type ItemStatus = 'pending' | 'compressing' | 'extracting' | 'generating' | 'done' | 'failed_extract' | 'failed_generate';

interface QueueItem {
  id: string;
  file: File;
  thumbUrl: string;
  status: ItemStatus;
  extracted?: string;
  reply?: string;
  logId?: string | null;
  errorMessage?: string;
  compressedBase64?: string;
}

interface Props {
  context: BatchJobContext | null; // null while user not ready
  energyBalance: number;
  onEnergySpent?: (amount: number) => void;
  onAfterRun?: () => void;
  disabled?: boolean;
}

export interface ImageBatchPanelHandle {
  addFiles: (files: File[]) => void;
  count: () => number;
}

const ImageBatchPanel = forwardRef<ImageBatchPanelHandle, Props>(function ImageBatchPanel(
  { context, energyBalance, onEnergySpent, onAfterRun, disabled }, ref,
) {
  const { toast } = useToast();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doneCount = items.filter(i => i.status === 'done' || i.status === 'failed_extract' || i.status === 'failed_generate').length;
  const totalCount = items.length;
  const failedCount = items.filter(i => i.status === 'failed_extract' || i.status === 'failed_generate').length;
  const allFinished = totalCount > 0 && doneCount === totalCount;

  const stepMessages = [
    '이미지를 준비하고 있어요...',
    '이미지에서 리뷰 내용을 읽는 중이에요...',
    '추출한 리뷰로 답변을 만들고 있어요...',
    '답변 결과를 정리하고 있어요...',
    '완료되었습니다.',
  ];

  const addFiles = useCallback((files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    setItems(prev => {
      const remaining = MAX_QUEUE - prev.length;
      if (remaining <= 0) {
        toast({ title: '이미지는 최대 10장까지만 처리할 수 있습니다.', variant: 'destructive' });
        return prev;
      }
      const overflow = imageFiles.length > remaining;
      const accept = imageFiles.slice(0, remaining);
      if (overflow) {
        toast({ title: '이미지는 최대 10장까지만 처리할 수 있습니다.', variant: 'destructive' });
      }
      const next: QueueItem[] = accept.map(file => ({
        id: crypto.randomUUID(),
        file,
        thumbUrl: URL.createObjectURL(file),
        status: 'pending',
      }));
      return [...prev, ...next];
    });
  }, [toast]);

  const removeItem = (id: string) => {
    setItems(prev => {
      const target = prev.find(i => i.id === id);
      if (target) URL.revokeObjectURL(target.thumbUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const clearAll = () => {
    setItems(prev => {
      prev.forEach(i => URL.revokeObjectURL(i.thumbUrl));
      return [];
    });
    setBatchId(null);
  };

  const updateItem = (id: string, patch: Partial<QueueItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  };

  // Concurrency-limited runner
  async function runWithLimit<T>(jobs: (() => Promise<T>)[], limit: number) {
    const results: T[] = new Array(jobs.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= jobs.length) return;
        try { results[i] = await jobs[i](); } catch (e) { /* per-job handled */ }
      }
    });
    await Promise.all(workers);
    return results;
  }

  const processSingleItem = async (item: QueueItem, batchIdLocal: string, indexInBatch: number) => {
    if (!context) return;
    // Compress
    updateItem(item.id, { status: 'compressing' });
    let base64 = item.compressedBase64 || '';
    if (!base64) {
      try {
        const out = await compressImageFile(item.file, { maxWidth: 1400, quality: 0.78 });
        base64 = out.base64;
        updateItem(item.id, { compressedBase64: base64 });
      } catch (e: any) {
        updateItem(item.id, { status: 'failed_extract', errorMessage: e?.message || '이미지 처리 실패' });
        return;
      }
    }

    // OCR
    updateItem(item.id, { status: 'extracting' });
    let extractedText = '';
    try {
      const { data, error } = await supabase.functions.invoke('extract-from-image', {
        body: { image: base64, type: context.type },
      });
      if (error) throw error;
      const arr: string[] = data?.items || [];
      extractedText = arr.filter(Boolean).join('\n\n').trim();
      if (!extractedText) {
        updateItem(item.id, { status: 'failed_extract', errorMessage: '텍스트를 찾지 못했습니다.', extracted: '' });
        return;
      }
      updateItem(item.id, { extracted: extractedText });
    } catch (e: any) {
      updateItem(item.id, { status: 'failed_extract', errorMessage: e?.message || '텍스트 추출 실패' });
      return;
    }

    // Generate
    updateItem(item.id, { status: 'generating' });
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: {
          type: context.type,
          text: extractedText,
          product: context.productCtx,
          energy_cost: context.energyCost,
          platform: context.platformPayload,
          ...context.extraPayload,
        },
      });
      if (error) throw error;
      const reply = data?.response;
      if (!reply) throw new Error(data?.error || '답변 생성 실패');
      onEnergySpent?.(context.energyCost);

      // Persist generations + generation_logs
      const { data: genRow } = await supabase.from('generations').insert({
        user_id: context.userId,
        type: context.type,
        input_text: extractedText,
        output_text: reply,
        product_id: context.productId,
      }).select('id').maybeSingle();

      const { data: logRow } = await supabase.from('generation_logs').insert({
        user_id: context.userId,
        generation_id: genRow?.id ?? null,
        type: context.type,
        platform: context.platformPayload?.id ?? null,
        business_category: context.businessCategory,
        sub_category: context.subCategory,
        tone: context.tone,
        rating: context.rating,
        original_review: maskPII(extractedText).slice(0, 4000),
        generated_reply: reply,
        source: 'image_batch',
        image_batch_id: batchIdLocal,
        image_index: indexInBatch,
      } as any).select('id').maybeSingle();

      updateItem(item.id, { status: 'done', reply, logId: logRow?.id ?? null });
    } catch (e: any) {
      updateItem(item.id, { status: 'failed_generate', errorMessage: e?.message || '답변 생성 실패' });
    }
  };

  const runBatch = async () => {
    if (!context) return;
    if (items.length === 0) return;
    const needed = items.length * context.energyCost;
    if (needed > energyBalance) {
      toast({ title: '에너지 부족', description: `이미지 ${items.length}장 처리에 ${needed}⚡ 필요합니다.`, variant: 'destructive' });
      return;
    }
    setRunning(true);
    const newBatch = crypto.randomUUID();
    setBatchId(newBatch);
    // Reset prior results so reruns don't double-log
    setItems(prev => prev.map(i => ({ ...i, status: 'pending', reply: undefined, logId: undefined, errorMessage: undefined })));

    // Snapshot ordered list for indexing
    const ordered = [...items];
    // Phase 1+2 fused per-item with per-phase concurrency would be complex;
    // we run per-item full pipeline with overall GEN_CONCURRENCY, since OCR+gen are sequential per item.
    // To honor OCR_CONCURRENCY independent of GEN, we do two-phase:
    // 1) compress + OCR with limit OCR_CONCURRENCY
    // 2) generate with limit GEN_CONCURRENCY for those that succeeded
    const idToIndex = new Map(ordered.map((it, idx) => [it.id, idx]));

    const ocrJobs = ordered.map(item => async () => {
      // compress
      updateItem(item.id, { status: 'compressing' });
      let base64 = '';
      try {
        const out = await compressImageFile(item.file, { maxWidth: 1400, quality: 0.78 });
        base64 = out.base64;
        updateItem(item.id, { compressedBase64: base64 });
      } catch (e: any) {
        updateItem(item.id, { status: 'failed_extract', errorMessage: e?.message || '이미지 처리 실패' });
        return;
      }
      updateItem(item.id, { status: 'extracting' });
      try {
        const { data, error } = await supabase.functions.invoke('extract-from-image', {
          body: { image: base64, type: context.type },
        });
        if (error) throw error;
        const arr: string[] = data?.items || [];
        const text = arr.filter(Boolean).join('\n\n').trim();
        if (!text) {
          updateItem(item.id, { status: 'failed_extract', errorMessage: '텍스트를 찾지 못했습니다.', extracted: '' });
          return;
        }
        updateItem(item.id, { extracted: text });
      } catch (e: any) {
        updateItem(item.id, { status: 'failed_extract', errorMessage: e?.message || '텍스트 추출 실패' });
      }
    });
    await runWithLimit(ocrJobs, OCR_CONCURRENCY);

    // Snapshot updated items
    const snapshot = await new Promise<QueueItem[]>((resolve) => {
      setItems(prev => { resolve(prev); return prev; });
    });

    const genTargets = snapshot.filter(i => i.extracted && (i.status === 'extracting' || i.status === 'pending' || i.status === 'compressing' || i.status === 'generating' || (!['failed_extract'].includes(i.status))));
    const genJobs = genTargets.map(item => async () => {
      updateItem(item.id, { status: 'generating' });
      const indexInBatch = idToIndex.get(item.id) ?? 0;
      try {
        const { data, error } = await supabase.functions.invoke('generate-response', {
          body: {
            type: context.type,
            text: item.extracted,
            product: context.productCtx,
            energy_cost: context.energyCost,
            platform: context.platformPayload,
            ...context.extraPayload,
          },
        });
        if (error) throw error;
        const reply = data?.response;
        if (!reply) throw new Error(data?.error || '답변 생성 실패');
        onEnergySpent?.(context.energyCost);

        const { data: genRow } = await supabase.from('generations').insert({
          user_id: context.userId,
          type: context.type,
          input_text: item.extracted!,
          output_text: reply,
          product_id: context.productId,
        }).select('id').maybeSingle();

        const { data: logRow } = await supabase.from('generation_logs').insert({
          user_id: context.userId,
          generation_id: genRow?.id ?? null,
          type: context.type,
          platform: context.platformPayload?.id ?? null,
          business_category: context.businessCategory,
          sub_category: context.subCategory,
          tone: context.tone,
          rating: context.rating,
          original_review: maskPII(item.extracted!).slice(0, 4000),
          generated_reply: reply,
          source: 'image_batch',
          image_batch_id: newBatch,
          image_index: indexInBatch,
        } as any).select('id').maybeSingle();

        updateItem(item.id, { status: 'done', reply, logId: logRow?.id ?? null });
      } catch (e: any) {
        updateItem(item.id, { status: 'failed_generate', errorMessage: e?.message || '답변 생성 실패' });
      }
    });
    await runWithLimit(genJobs, GEN_CONCURRENCY);

    setRunning(false);
    onAfterRun?.();
  };

  const retryItem = async (id: string) => {
    if (!context || running) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    setRunning(true);
    const indexInBatch = items.findIndex(i => i.id === id);
    await processSingleItem(item, batchId || crypto.randomUUID(), indexInBatch);
    setRunning(false);
  };

  const copyAll = async () => {
    const dones = items.filter(i => i.status === 'done' && i.reply);
    if (dones.length === 0) return;
    const text = dones.map((i, idx) => `[답변 #${idx + 1}]\n${i.reply}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${dones.length}개 답변 전체 복사됨` });
    } catch {
      toast({ title: '복사 실패', variant: 'destructive' });
    }
  };

  const copyOne = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast({ title: '복사됨' }); }
    catch { toast({ title: '복사 실패', variant: 'destructive' }); }
  };

  const queueFull = items.length >= MAX_QUEUE;
  const canRun = !running && items.length > 0 && !disabled && !!context;

  // Expose paste handler via window event for parent
  // (Generate.tsx will call addFiles directly via ref-like prop in future; we currently just rely on parent forwarding)

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6 shadow-card">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">이미지 일괄 처리 대기열</h3>
          <span className={`text-xs ${queueFull ? 'text-destructive' : 'text-muted-foreground'}`}>{items.length}/{MAX_QUEUE}장</span>
        </div>
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={onPick} className="hidden" id="batch-image-input" disabled={running || queueFull} />
          <label htmlFor="batch-image-input">
            <Button asChild size="sm" variant="outline" disabled={running || queueFull}>
              <span className="cursor-pointer"><ImageIcon className="w-3.5 h-3.5 mr-1" /> 이미지 추가</span>
            </Button>
          </label>
          {items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={clearAll} disabled={running}>전체 비우기</Button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          이미지를 붙여넣기(Ctrl+V), 드래그, 또는 위 버튼으로 추가해 주세요. 최대 10장까지 모은 뒤 한 번에 답변을 생성합니다.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
          {items.map((it, idx) => (
            <div key={it.id} className="relative group rounded-md overflow-hidden border border-border bg-muted/30 aspect-square">
              <img src={it.thumbUrl} alt={`이미지 ${idx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] flex items-center justify-between">
                <span className="text-muted-foreground">#{idx + 1}</span>
                <StatusPill status={it.status} />
              </div>
              {!running && (
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/80 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-colors"
                  aria-label="삭제"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] text-muted-foreground">
          예상 소비: <span className="font-medium text-foreground">{items.length * (context?.energyCost ?? 0)}⚡</span>
          {items.length > 0 && context && ` (장당 ${context.energyCost}⚡)`}
        </p>
        <Button onClick={runBatch} disabled={!canRun} className="gradient-primary text-primary-foreground">
          {running
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 일괄 답변 생성 중... ({doneCount}/{totalCount})</>
            : <><Wand2 className="w-4 h-4 mr-2" /> 이미지 일괄 답변 생성 ({items.length}장)</>}
        </Button>
      </div>

      {(running || allFinished) && (
        <div className="mt-4">
          <SmoothProgress
            active={running}
            done={!running && allFinished && failedCount === 0}
            failed={!running && allFinished && failedCount === totalCount}
            steps={stepMessages}
            title={running ? '이미지 처리 중' : allFinished ? '완료' : '대기'}
            subtitle={`${doneCount}/${totalCount} 처리 ${running ? '중' : '완료'}${failedCount ? ` · 실패 ${failedCount}` : ''}`}
          />
        </div>
      )}

      {/* Per-image results */}
      {items.some(i => i.status === 'done' || i.status === 'failed_extract' || i.status === 'failed_generate') && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">결과</h4>
            <Button size="sm" variant="outline" onClick={copyAll} disabled={!items.some(i => i.status === 'done')}>
              <Copy className="w-3.5 h-3.5 mr-1" /> 전체 복사
            </Button>
          </div>
          {items.map((it, idx) => {
            if (it.status === 'done' && it.reply) {
              return (
                <div key={it.id} className="rounded-lg border border-border bg-card p-3 animate-fade-in">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> 답변 #{idx + 1}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => {
                      copyOne(it.reply!);
                      if (it.logId) supabase.from('generation_logs').update({ copied: true }).eq('id', it.logId);
                    }}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> 복사
                    </Button>
                  </div>
                  {it.extracted && (
                    <details className="mb-2">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">원문 보기</summary>
                      <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded p-2">{it.extracted}</p>
                    </details>
                  )}
                  <p className="text-sm text-foreground whitespace-pre-wrap">{it.reply}</p>
                  <FeedbackBar
                    logId={it.logId ?? null}
                    initialReply={it.reply}
                    onEditedReplyChange={(t) => updateItem(it.id, { reply: t })}
                  />
                </div>
              );
            }
            if (it.status === 'failed_extract' || it.status === 'failed_generate') {
              return (
                <div key={it.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> #{idx + 1}{' '}
                      {it.status === 'failed_extract' ? '텍스트 추출 실패' : '답변 생성 실패'}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => retryItem(it.id)} disabled={running}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> 재시도
                    </Button>
                  </div>
                  {it.errorMessage && <p className="text-xs text-muted-foreground">{it.errorMessage}</p>}
                </div>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { label: string; cls: string }> = {
    pending: { label: '대기', cls: 'text-muted-foreground' },
    compressing: { label: '압축', cls: 'text-primary' },
    extracting: { label: '추출 중', cls: 'text-primary' },
    generating: { label: '생성 중', cls: 'text-primary' },
    done: { label: '완료', cls: 'text-green-600' },
    failed_extract: { label: '추출 실패', cls: 'text-destructive' },
    failed_generate: { label: '생성 실패', cls: 'text-destructive' },
  };
  const m = map[status];
  return <span className={`font-medium ${m.cls}`}>{m.label}</span>;
}

// Re-export helper for parent to add files imperatively
export function useImageBatch() {
  // placeholder for future ref API; parent uses controlled list pattern via prop
}

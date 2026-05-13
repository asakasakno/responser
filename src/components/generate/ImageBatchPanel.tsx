import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
const GEN_CONCURRENCY = 3;

type ImageStatus =
  | 'pending'
  | 'compressing'
  | 'extracting'
  | 'extracted'
  | 'failed_extract';

type ReviewStatus = 'pending' | 'generating' | 'done' | 'failed';

interface ExtractedReview {
  id: string;
  sourceImageId: string;
  sourceImageIndex: number; // 1-based for display
  reviewIndex: number;      // 0-based within image
  text: string;
  reply?: string;
  logId?: string | null;
  status: ReviewStatus;
  errorMessage?: string;
}

interface QueueItem {
  id: string;
  file: File;
  thumbUrl: string;
  status: ImageStatus;
  errorMessage?: string;
  compressedBase64?: string;
  extractedReviews: ExtractedReview[];
}

interface Props {
  context: BatchJobContext | null;
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
  const [phase, setPhase] = useState<'idle' | 'ocr' | 'gen' | 'done'>('idle');
  const [batchId, setBatchId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Live ref so concurrent jobs can read current items without stale closures.
  const itemsRef = useRef<QueueItem[]>([]);
  itemsRef.current = items;

  // Aggregate counters
  const allReviews = useMemo(() => items.flatMap(i => i.extractedReviews), [items]);
  const totalImages = items.length;
  const totalReviews = allReviews.length;
  const generatedCount = allReviews.filter(r => r.status === 'done').length;
  const failedReviewCount = allReviews.filter(r => r.status === 'failed').length;
  const failedImageCount = items.filter(i => i.status === 'failed_extract').length;
  const ocrDoneCount = items.filter(i => i.status === 'extracted' || i.status === 'failed_extract').length;
  const allFinished =
    !running &&
    items.length > 0 &&
    ocrDoneCount === totalImages &&
    (totalReviews === 0 || generatedCount + failedReviewCount === totalReviews);
  const hasAnyResult = allReviews.some(r => r.status === 'done' || r.status === 'failed');

  const stepMessages = useMemo(() => {
    const ocrStep = totalImages > 0
      ? `이미지에서 리뷰 내용을 읽는 중이에요... (${ocrDoneCount}/${totalImages}장)`
      : '이미지에서 리뷰 내용을 읽는 중이에요...';
    const reviewExtractedStep = totalReviews > 0
      ? `리뷰 ${totalReviews}개를 추출했어요`
      : '리뷰를 추출하고 있어요...';
    const genStep = totalReviews > 0
      ? `답변을 생성 중이에요... (${generatedCount}/${totalReviews}개 완료)`
      : '답변을 생성 중이에요...';
    return [
      '이미지를 준비하고 있어요...',
      ocrStep,
      reviewExtractedStep,
      genStep,
      '결과를 정리하고 있어요...',
      '완료되었습니다.',
    ];
  }, [totalImages, ocrDoneCount, totalReviews, generatedCount]);

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
        extractedReviews: [],
      }));
      return [...prev, ...next];
    });
  }, [toast]);

  useImperativeHandle(ref, () => ({
    addFiles,
    count: () => items.length,
  }), [addFiles, items.length]);

  const updateItem = (id: string, patch: Partial<QueueItem> | ((p: QueueItem) => Partial<QueueItem>)) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const p = typeof patch === 'function' ? patch(i) : patch;
      return { ...i, ...p };
    }));
  };

  const updateReview = (imgId: string, reviewId: string, patch: Partial<ExtractedReview>) => {
    setItems(prev => prev.map(i => {
      if (i.id !== imgId) return i;
      return {
        ...i,
        extractedReviews: i.extractedReviews.map(r => r.id === reviewId ? { ...r, ...patch } : r),
      };
    }));
  };

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
    setPhase('idle');
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
        try { results[i] = await jobs[i](); } catch { /* per-job handled */ }
      }
    });
    await Promise.all(workers);
    return results;
  }

  /** Phase 1: compress + OCR an image, populating extractedReviews. */
  const ocrImage = async (imgId: string) => {
    if (!context) return;
    const item = itemsRef.current.find(i => i.id === imgId);
    if (!item) return;

    updateItem(imgId, { status: 'compressing' });
    let base64 = item.compressedBase64 || '';
    if (!base64) {
      try {
        const out = await compressImageFile(item.file, { maxWidth: 1400, quality: 0.78 });
        base64 = out.base64;
        updateItem(imgId, { compressedBase64: base64 });
      } catch (e: any) {
        updateItem(imgId, { status: 'failed_extract', errorMessage: e?.message || '이미지 처리 실패' });
        return;
      }
    }

    updateItem(imgId, { status: 'extracting' });
    try {
      const { data, error } = await supabase.functions.invoke('extract-from-image', {
        body: { image: base64, type: context.type },
      });
      if (error) throw error;
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      // Server now returns [{review_index, text}], but tolerate string[] too.
      const reviews: ExtractedReview[] = rawItems
        .map((it: any, idx: number) => {
          const text = typeof it === 'string' ? it : (typeof it?.text === 'string' ? it.text : '');
          const ri = typeof it === 'object' && Number.isFinite(Number(it?.review_index))
            ? Number(it.review_index) : idx;
          return { text: String(text || '').trim(), reviewIndex: ri };
        })
        .filter((r: any) => r.text.length > 0)
        .map((r: any, idx: number): ExtractedReview => ({
          id: crypto.randomUUID(),
          sourceImageId: imgId,
          sourceImageIndex: 0, // assigned below from current items order
          reviewIndex: r.reviewIndex ?? idx,
          text: r.text,
          status: 'pending',
        }));

      if (reviews.length === 0) {
        updateItem(imgId, { status: 'failed_extract', errorMessage: '리뷰를 찾지 못했습니다.', extractedReviews: [] });
        return;
      }

      // Stamp sourceImageIndex from current order in queue
      setItems(prev => {
        const order = prev.findIndex(p => p.id === imgId);
        const stamped = reviews.map(r => ({ ...r, sourceImageIndex: order + 1 }));
        return prev.map(p => p.id === imgId
          ? { ...p, status: 'extracted', extractedReviews: stamped, errorMessage: undefined }
          : p);
      });
    } catch (e: any) {
      updateItem(imgId, { status: 'failed_extract', errorMessage: e?.message || '텍스트 추출 실패' });
    }
  };

  /** Phase 2: generate one reply for a single extracted review. */
  const generateReview = async (imgId: string, reviewId: string, batchIdLocal: string) => {
    if (!context) return;
    const img = itemsRef.current.find(i => i.id === imgId);
    const review = img?.extractedReviews.find(r => r.id === reviewId);
    if (!img || !review) return;

    updateReview(imgId, reviewId, { status: 'generating', errorMessage: undefined });
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: {
          type: context.type,
          text: review.text,
          product: context.productCtx,
          energy_cost: context.energyCost,
          platform: context.platformPayload,
          ...context.extraPayload,
        },
      });
      if (error) throw error;
      const reply: string | undefined = data?.response;
      if (!reply) throw new Error(data?.error || '답변 생성 실패');

      // Energy spent only on success.
      onEnergySpent?.(context.energyCost);

      // Persist generations + generation_logs (per-review).
      const orderedIndex = itemsRef.current.findIndex(i => i.id === imgId);
      const { data: genRow } = await supabase.from('generations').insert({
        user_id: context.userId,
        type: context.type,
        input_text: review.text,
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
        original_review: maskPII(review.text).slice(0, 4000),
        generated_reply: reply,
        source: 'image_batch',
        image_batch_id: batchIdLocal,
        image_index: orderedIndex,
        review_index: review.reviewIndex,
      } as any).select('id').maybeSingle();

      updateReview(imgId, reviewId, { status: 'done', reply, logId: logRow?.id ?? null });
    } catch (e: any) {
      updateReview(imgId, reviewId, { status: 'failed', errorMessage: e?.message || '답변 생성 실패' });
    }
  };

  const runBatch = async () => {
    if (!context || items.length === 0) return;

    // Pre-flight: rough estimate based on images (true cost computed after OCR; we recheck per-review during gen).
    const minNeeded = items.length * context.energyCost;
    if (minNeeded > energyBalance) {
      toast({ title: '에너지 부족', description: `이미지 ${items.length}장 처리에 최소 ${minNeeded}⚡ 필요합니다.`, variant: 'destructive' });
      return;
    }

    setRunning(true);
    setPhase('ocr');
    const newBatch = crypto.randomUUID();
    setBatchId(newBatch);

    // Reset previous results so reruns don't double-log.
    setItems(prev => prev.map(i => ({
      ...i,
      status: 'pending',
      errorMessage: undefined,
      extractedReviews: [],
    })));

    // Phase 1: OCR per image (parallel, OCR_CONCURRENCY).
    const ocrJobs = itemsRef.current.map(it => () => ocrImage(it.id));
    await runWithLimit(ocrJobs, OCR_CONCURRENCY);

    // Phase 2: generate per extracted review (parallel, GEN_CONCURRENCY).
    setPhase('gen');
    const reviews = itemsRef.current.flatMap(i => i.extractedReviews.map(r => ({ imgId: i.id, reviewId: r.id })));
    const totalReviewsLocal = reviews.length;

    if (totalReviewsLocal === 0) {
      setPhase('done');
      setRunning(false);
      onAfterRun?.();
      return;
    }

    // If energy is short of true demand, warn (but proceed — server enforces too).
    const trueNeeded = totalReviewsLocal * context.energyCost;
    if (trueNeeded > energyBalance) {
      toast({
        title: '에너지 부족 가능성',
        description: `리뷰 ${totalReviewsLocal}개 답변에 ${trueNeeded}⚡ 필요. 잔량이 부족하면 일부만 처리됩니다.`,
      });
    }

    const genJobs = reviews.map(({ imgId, reviewId }) => () => generateReview(imgId, reviewId, newBatch));
    await runWithLimit(genJobs, GEN_CONCURRENCY);

    setPhase('done');
    setRunning(false);
    onAfterRun?.();
  };

  const retryReview = async (imgId: string, reviewId: string) => {
    if (!context || running) return;
    setRunning(true);
    await generateReview(imgId, reviewId, batchId || crypto.randomUUID());
    setRunning(false);
  };

  const retryImage = async (imgId: string) => {
    if (!context || running) return;
    setRunning(true);
    setPhase('ocr');
    await ocrImage(imgId);
    // Auto-generate any newly extracted reviews for this image.
    const img = itemsRef.current.find(i => i.id === imgId);
    if (img && img.extractedReviews.length > 0) {
      setPhase('gen');
      const localBatch = batchId || crypto.randomUUID();
      if (!batchId) setBatchId(localBatch);
      const jobs = img.extractedReviews.map(r => () => generateReview(imgId, r.id, localBatch));
      await runWithLimit(jobs, GEN_CONCURRENCY);
    }
    setPhase('done');
    setRunning(false);
  };

  const copyAll = async () => {
    const dones = allReviews.filter(r => r.status === 'done' && r.reply);
    if (dones.length === 0) return;
    const text = dones.map((r, idx) => `[답변 #${idx + 1}]\n${r.reply}`).join('\n\n');
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

  // Smooth-progress weighting: OCR 30% / generation 70%.
  const ocrFraction = totalImages > 0 ? ocrDoneCount / totalImages : 0;
  const genFraction = totalReviews > 0
    ? (generatedCount + failedReviewCount) / totalReviews
    : (phase === 'done' ? 1 : 0);
  const externalProgress = Math.min(100, Math.round((ocrFraction * 30) + (genFraction * 70)));

  // Pre-OCR estimate vs post-OCR confirmed cost label
  const energyEstimateLabel = (() => {
    if (!context) return null;
    if (totalReviews === 0) {
      return `예상: 이미지 ${totalImages}장 × ${context.energyCost}⚡ = ${totalImages * context.energyCost}⚡ (OCR 후 확정)`;
    }
    return `확정: 추출 리뷰 ${totalReviews}개 × ${context.energyCost}⚡ = ${totalReviews * context.energyCost}⚡`;
  })();

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

      {/* Top summary */}
      {items.length > 0 && (
        <div className="mb-3 rounded-md bg-muted/40 border border-border px-3 py-2 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>이미지 <span className="font-medium text-foreground">{totalImages}장</span></span>
          <span>추출 리뷰 <span className="font-medium text-foreground">{totalReviews}개</span></span>
          <span>답변 <span className="font-medium text-foreground">{generatedCount}/{totalReviews}개</span></span>
          {failedReviewCount > 0 && <span className="text-destructive">생성 실패 {failedReviewCount}</span>}
          {failedImageCount > 0 && <span className="text-destructive">OCR 실패 {failedImageCount}</span>}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          이미지를 붙여넣기(Ctrl+V), 드래그, 또는 위 버튼으로 추가해 주세요. 한 이미지에 리뷰가 여러 개 있어도 각각 분리해 답변을 만듭니다.
        </p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
          {items.map((it, idx) => (
            <div key={it.id} className="relative group rounded-md overflow-hidden border border-border bg-muted/30 aspect-square">
              <img src={it.thumbUrl} alt={`이미지 ${idx + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-sm px-1.5 py-0.5 text-[10px] flex items-center justify-between">
                <span className="text-muted-foreground">#{idx + 1}</span>
                <ImageStatusPill item={it} />
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
          {energyEstimateLabel}
        </p>
        <Button onClick={runBatch} disabled={!canRun} className="gradient-primary text-primary-foreground">
          {running
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 처리 중... ({generatedCount}/{Math.max(totalReviews, 1)})</>
            : <><Wand2 className="w-4 h-4 mr-2" /> 이미지 일괄 답변 생성 ({items.length}장)</>}
        </Button>
      </div>

      {(running || allFinished) && (
        <div className="mt-4">
          <SmoothProgress
            active={running}
            done={!running && allFinished && failedReviewCount === 0 && failedImageCount === 0}
            failed={!running && allFinished && (failedReviewCount + failedImageCount) > 0 && generatedCount === 0}
            steps={stepMessages}
            title={running ? (phase === 'ocr' ? '이미지 분석 중' : '답변 생성 중') : '완료'}
            subtitle={
              totalReviews > 0
                ? `리뷰 ${generatedCount}/${totalReviews}개 답변 ${running ? '생성 중' : '완료'}${failedReviewCount ? ` · 실패 ${failedReviewCount}` : ''}`
                : `이미지 ${ocrDoneCount}/${totalImages}장 분석${failedImageCount ? ` · 실패 ${failedImageCount}` : ''}`
            }
            externalProgress={externalProgress}
          />
        </div>
      )}

      {/* Per-review results, grouped sequentially by image */}
      {hasAnyResult && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">결과 (리뷰 단위)</h4>
            <Button size="sm" variant="outline" onClick={copyAll} disabled={!allReviews.some(r => r.status === 'done')}>
              <Copy className="w-3.5 h-3.5 mr-1" /> 전체 복사
            </Button>
          </div>

          {items.map((img, imgIdx) => {
            // Image-level error card
            if (img.status === 'failed_extract') {
              return (
                <div key={img.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> 이미지 #{imgIdx + 1} · 텍스트 추출 실패
                    </span>
                    <Button size="sm" variant="outline" onClick={() => retryImage(img.id)} disabled={running}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> 재시도
                    </Button>
                  </div>
                  {img.errorMessage && <p className="text-xs text-muted-foreground">{img.errorMessage}</p>}
                </div>
              );
            }
            if (img.extractedReviews.length === 0) return null;

            return (
              <div key={img.id} className="space-y-2">
                {img.extractedReviews.map((r, rIdx) => {
                  if (r.status === 'done' && r.reply) {
                    return (
                      <div key={r.id} className="rounded-lg border border-border bg-card p-3 animate-fade-in">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                            이미지 #{imgIdx + 1} · 리뷰 #{rIdx + 1}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => {
                            copyOne(r.reply!);
                            if (r.logId) supabase.from('generation_logs').update({ copied: true }).eq('id', r.logId);
                          }}>
                            <Copy className="w-3.5 h-3.5 mr-1" /> 복사
                          </Button>
                        </div>
                        <details className="mb-2">
                          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">원문 보기</summary>
                          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded p-2">{r.text}</p>
                        </details>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{r.reply}</p>
                        <FeedbackBar
                          logId={r.logId ?? null}
                          initialReply={r.reply}
                          onEditedReplyChange={(t) => updateReview(img.id, r.id, { reply: t })}
                        />
                      </div>
                    );
                  }
                  if (r.status === 'failed') {
                    return (
                      <div key={r.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                            이미지 #{imgIdx + 1} · 리뷰 #{rIdx + 1} · 답변 생성 실패
                          </span>
                          <Button size="sm" variant="outline" onClick={() => retryReview(img.id, r.id)} disabled={running}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> 재시도
                          </Button>
                        </div>
                        {r.errorMessage && <p className="text-xs text-muted-foreground">{r.errorMessage}</p>}
                        <details className="mt-2">
                          <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">원문 보기</summary>
                          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap bg-muted/40 rounded p-2">{r.text}</p>
                        </details>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

export default ImageBatchPanel;

function ImageStatusPill({ item }: { item: QueueItem }) {
  if (item.status === 'failed_extract') {
    return <span className="font-medium text-destructive">추출 실패</span>;
  }
  if (item.status === 'extracted') {
    return <span className="font-medium text-green-600">리뷰 {item.extractedReviews.length}개</span>;
  }
  if (item.status === 'extracting') return <span className="font-medium text-primary">추출 중</span>;
  if (item.status === 'compressing') return <span className="font-medium text-primary">압축</span>;
  return <span className="font-medium text-muted-foreground">대기</span>;
}

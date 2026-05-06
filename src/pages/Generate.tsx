import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  ENERGY_COSTS,
  TONES, type Tone,
  BUSINESS_CATEGORIES, type BusinessCategory,
  INQUIRY_CATEGORIES, type InquiryCategory,
  COMPENSATIONS, type Compensation,
  CLAIM_RISK_KEYWORDS, PLATFORM_CHAR_LIMITS,
} from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Image, Loader2, ArrowUp, AlertTriangle, Zap, Save, ShieldAlert, Star } from 'lucide-react';

import GenerateResultCard from '@/components/generate/GenerateResultCard';
import BatchResultsList from '@/components/generate/BatchResultsList';
import EnergyIndicator from '@/components/generate/EnergyIndicator';
import EnergyAnimation from '@/components/generate/EnergyAnimation';
import { ALL_PLATFORMS, getPlatformLabel, getAllowedBusinessCategories } from '@/lib/platforms';

type GenType = 'review' | 'inquiry' | 'claim';

interface Product {
  id: string;
  name: string;
  category: string;
  note: string | null;
}

export default function Generate() {
  const [searchParams] = useSearchParams();
  const initType = (searchParams.get('type') as GenType) || 'review';
  const { user, plan, energyBalance, maxEnergy, refreshEnergy, refreshProfile, refreshSubscription } = useAuth();
  const { toast } = useToast();

  const [genType, setGenType] = useState<GenType>(initType);
  const [inputText, setInputText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>('none');
  // (deprecated: 답변 스타일 → 답변 톤으로 통합됨)
  const [products, setProducts] = useState<Product[]>([]);
  const [userPlatforms, setUserPlatforms] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('auto');
  const [customPlatform, setCustomPlatform] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  
  const [batchResults, setBatchResults] = useState<{ input: string; output: string }[]>([]);
  const [batchTotalExtracted, setBatchTotalExtracted] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [energyAnim, setEnergyAnim] = useState<{ amount: number; type: 'earn' | 'spend' } | null>(null);

  // MVP additions
  const [tone, setTone] = useState<Tone | 'none'>('none');
  const [businessCategory, setBusinessCategory] = useState<BusinessCategory | 'none'>('none');
  const [reviewRating, setReviewRating] = useState<number>(0);
  const [reviewNickname, setReviewNickname] = useState<string>('');
  const [inquiryCategory, setInquiryCategory] = useState<InquiryCategory | 'none'>('none');
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [claimSeverity, setClaimSeverity] = useState<'low' | 'normal' | 'high'>('normal');
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [autoCopy, setAutoCopy] = useState<boolean>(() => localStorage.getItem('autoCopy') === '1');

  const energyCost = ENERGY_COSTS[genType] || 1;
  const isLimitReached = energyBalance < energyCost;

  // Risk keyword detection (claim only)
  const detectedRisks = useMemo(
    () => genType === 'claim' ? CLAIM_RISK_KEYWORDS.filter(k => inputText.includes(k)) : [],
    [inputText, genType]
  );

  const charLimit = selectedPlatform && PLATFORM_CHAR_LIMITS[selectedPlatform];

  // 플랫폼별 허용 업종 필터
  const allowedCategoryIds = useMemo(() => getAllowedBusinessCategories(selectedPlatform), [selectedPlatform]);
  const filteredBusinessCategories = useMemo(
    () => allowedCategoryIds ? BUSINESS_CATEGORIES.filter(b => allowedCategoryIds.includes(b.id)) : BUSINESS_CATEGORIES,
    [allowedCategoryIds]
  );

  // 플랫폼 변경 시 비호환 업종이면 자동 리셋
  useEffect(() => {
    if (allowedCategoryIds && businessCategory !== 'none' && !allowedCategoryIds.includes(businessCategory)) {
      setBusinessCategory('none');
    }
  }, [allowedCategoryIds, businessCategory]);

  useEffect(() => { localStorage.setItem('autoCopy', autoCopy ? '1' : '0'); }, [autoCopy]);

  useEffect(() => {
    if (user) {
      supabase.from('products').select('id, name, category, note').eq('user_id', user.id).then(({ data }) => {
        if (data) setProducts(data);
      });
      supabase.from('profiles').select('platforms, business_category').eq('user_id', user.id).maybeSingle().then(({ data }) => {
        const list = (data?.platforms as string[]) || [];
        setUserPlatforms(list);
        if (list.length > 0) setSelectedPlatform(list[0]);
        const bc = (data as any)?.business_category;
        if (bc) setBusinessCategory(bc);
      });
    }
  }, [user]);

  // 진입 시 최신 구독/에너지/프로필 한도 즉시 재조회 (PaymentSuccess 직후 한도 오류 방지)
  useEffect(() => {
    if (!user) return;
    refreshSubscription?.();
    refreshProfile?.();
    refreshEnergy?.();
  }, [user, refreshSubscription, refreshProfile, refreshEnergy]);

  // Clipboard paste support for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) processImageFile(file);
          return;
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [genType, selectedProduct, isLimitReached, batchLoading, energyBalance]);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    if (files.length > 1 && plan !== 'pro') {
      toast({ title: '프로 전용 기능', description: '여러 이미지 동시 업로드는 Pro 플랜에서만 가능합니다.', variant: 'destructive' });
      processImageFile(files[0]);
      return;
    }
    processMultipleImages(files);
  };

  const getProductContext = () => {
    if (selectedProduct === 'none') return null;
    const p = products.find(p => p.id === selectedProduct);
    return p ? { id: p.id, name: p.name, category: p.category, note: p.note } : null;
  };

  const getStylePayload = () => (plan !== 'free' && selectedStyle !== 'none' ? selectedStyle : undefined);

  const getPlatformPayload = () => {
    if (selectedPlatform === 'auto' || !selectedPlatform) return undefined;
    if (selectedPlatform === 'other') {
      const c = customPlatform.trim();
      return c ? { id: 'other', label: c } : undefined;
    }
    return { id: selectedPlatform, label: getPlatformLabel(selectedPlatform) };
  };

  const buildExtraPayload = () => {
    const extra: Record<string, any> = {};
    if (tone !== 'none') extra.tone = tone;
    if (businessCategory !== 'none') extra.business_category = businessCategory;
    if (genType === 'review') {
      extra.review = {
        rating: reviewRating > 0 ? reviewRating : null,
        nickname: reviewNickname.trim() || null,
      };
    }
    if (genType === 'inquiry') {
      extra.inquiry = {
        category: inquiryCategory !== 'none' ? inquiryCategory : null,
        slots,
      };
    }
    if (genType === 'claim') {
      extra.claim = { severity: claimSeverity, compensations };
    }
    return extra;
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    if (isLimitReached) {
      toast({ title: '에너지 부족', description: '응답에너지가 부족합니다. 에너지를 충전해주세요.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: {
          type: genType, text: inputText, product: getProductContext(),
          energy_cost: energyCost, style: getStylePayload(), platform: getPlatformPayload(),
          ...buildExtraPayload(),
        },
      });
      if (error) throw error;
      if (!data || !data.response) throw new Error(data?.error || '답변을 생성할 수 없습니다.');
      setResult(data.response);
      setEnergyAnim({ amount: energyCost, type: 'spend' });
      await refreshEnergy();

      // Persist business category to profile (best-effort)
      if (businessCategory !== 'none') {
        supabase.from('profiles').update({ business_category: businessCategory }).eq('user_id', user!.id);
      }

      if (autoCopy) {
        try { await navigator.clipboard.writeText(data.response); toast({ title: '답변 자동 복사됨' }); } catch {}
      }

      await supabase.from('generations').insert({
        user_id: user!.id,
        type: genType,
        input_text: inputText,
        output_text: data.response,
        product_id: selectedProduct !== 'none' ? selectedProduct : null,
      });
    } catch (err: any) {
      toast({ title: '생성 실패', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!result.trim()) return;
    const title = window.prompt('템플릿 제목을 입력하세요', `${genType} 템플릿`);
    if (!title || !title.trim()) return;
    const { error } = await supabase.from('user_templates').insert({
      user_id: user!.id, title: title.trim().slice(0, 100), type: genType, content: result,
    });
    if (error) toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    else toast({ title: '템플릿으로 저장됨' });
  };


  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processMultipleImages = async (files: File[]) => {
    if (isLimitReached) {
      toast({ title: '에너지 부족', description: '응답에너지가 부족합니다.', variant: 'destructive' });
      return;
    }
    setBatchResults([]);
    setBatchTotalExtracted(0);
    setBatchLoading(true);

    try {
      let allItems: string[] = [];
      for (const file of files) {
        const base64 = await readFileAsBase64(file);
        const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-from-image', {
          body: { image: base64, type: genType },
        });
        if (extractError) throw extractError;
        allItems = allItems.concat(extractData.items || []);
      }

      setBatchTotalExtracted(allItems.length);

      const maxByPlan = plan === 'pro' ? 30 : plan === 'basic' ? 10 : 5;
      const maxByEnergy = Math.floor(energyBalance / energyCost);
      const processCount = Math.min(allItems.length, maxByPlan, maxByEnergy);
      const processItems = allItems.slice(0, processCount);

      const allResults: { input: string; output: string }[] = [];
      const product = getProductContext();
      for (let i = 0; i < processItems.length; i++) {
        setBatchProgress(Math.round(((i + 1) / processItems.length) * 100));
        const { data, error: genError } = await supabase.functions.invoke('generate-response', {
          body: { type: genType, text: processItems[i], product, energy_cost: energyCost, style: getStylePayload(), platform: getPlatformPayload(), ...buildExtraPayload() },
        });
        if (genError) throw genError;
        const output = data?.response || data?.error || '생성 실패';
        allResults.push({ input: processItems[i], output });

        await supabase.from('generations').insert({
          user_id: user!.id,
          type: genType,
          input_text: processItems[i],
          output_text: output,
          product_id: selectedProduct !== 'none' ? selectedProduct : null,
        });
      }

      const blurredCount = allItems.length - processCount;
      for (let i = 0; i < blurredCount; i++) {
        allResults.push({ input: allItems[processCount + i] || '', output: '__BLURRED__' });
      }

      setBatchResults(allResults);
      setEnergyAnim({ amount: processCount * energyCost, type: 'spend' });
      await refreshEnergy();
    } catch (err: any) {
      toast({ title: '처리 실패', description: err.message, variant: 'destructive' });
    } finally {
      setBatchLoading(false);
      setBatchProgress(0);
    }
  };

  const processImageFile = (file: File) => processMultipleImages([file]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    if (files.length > 1 && plan !== 'pro') {
      toast({ title: '프로 전용 기능', description: '여러 이미지 동시 업로드는 Pro 플랜에서만 가능합니다.', variant: 'destructive' });
      processImageFile(files[0]);
      return;
    }
    processMultipleImages(files);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '복사됨' });
  };

  const realResults = batchResults.filter(r => r.output !== '__BLURRED__');
  const copyAll = () => {
    const allText = realResults.map((r, i) => `[${i + 1}]\n원문: ${r.input}\n답변: ${r.output}`).join('\n\n---\n\n');
    copyToClipboard(allText);
  };

  return (
    <Layout>
      <div
        className={`p-6 md:p-8 max-w-3xl mx-auto relative ${isDragging ? 'ring-2 ring-primary ring-offset-2 rounded-xl' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {energyAnim && (
          <EnergyAnimation
            amount={energyAnim.amount}
            type={energyAnim.type}
            onComplete={() => setEnergyAnim(null)}
          />
        )}

        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-xl z-50 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Image className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="text-lg font-semibold text-primary">이미지를 놓아주세요</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">AI 답변 생성</h1>
          <EnergyIndicator balance={energyBalance} maxEnergy={maxEnergy} />
        </div>

        {isLimitReached && (
          <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">응답에너지가 부족합니다.</p>
              <p className="text-sm text-muted-foreground mt-1">
                미션을 완료하거나{' '}
                <Link to="/rewards" className="text-primary underline font-medium">에너지를 충전</Link>하거나{' '}
                <Link to="/pricing" className="text-primary underline font-medium">플랜을 업그레이드</Link>해주세요.
              </p>
            </div>
          </div>
        )}

        <Tabs value={genType} onValueChange={v => setGenType(v as GenType)} className="mb-6">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="review">
              리뷰 답변 <span className="ml-1.5 text-xs text-muted-foreground">-{ENERGY_COSTS.review}⚡</span>
            </TabsTrigger>
            <TabsTrigger value="inquiry">
              문의 답변 <span className="ml-1.5 text-xs text-muted-foreground">-{ENERGY_COSTS.inquiry}⚡</span>
            </TabsTrigger>
            <TabsTrigger value="claim">
              클레임 대응 <span className="ml-1.5 text-xs text-muted-foreground">-{ENERGY_COSTS.claim}⚡</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-1.5 block">판매 플랫폼</label>
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger>
              <SelectValue placeholder="플랫폼을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">기본(플랫폼 미지정)</SelectItem>
              {userPlatforms.length > 0 && userPlatforms.map(pid => (
                <SelectItem key={pid} value={pid}>{getPlatformLabel(pid)}</SelectItem>
              ))}
              {ALL_PLATFORMS.filter(p => !userPlatforms.includes(p.id)).map(p => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPlatform === 'other' && (
            <Input
              value={customPlatform}
              onChange={e => setCustomPlatform(e.target.value)}
              placeholder="플랫폼명 직접 입력"
              className="mt-2"
              maxLength={30}
            />
          )}
          <p className="text-[11px] text-muted-foreground mt-1.5">선택한 플랫폼의 응대 톤·정책에 맞춰 답변을 생성합니다.</p>
        </div>

        {products.length > 0 && (
          <div className="mb-4">
            <label className="text-sm font-medium text-foreground mb-1.5 block">상품 선택 (선택사항)</label>
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger>
                <SelectValue placeholder="상품을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.category})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-foreground">답변 스타일</label>
            {plan === 'free' && (
              <Link to="/pricing" className="text-xs text-primary underline">Basic+에서 사용 가능</Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setSelectedStyle('none')}
              disabled={plan === 'free'}
              className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                selectedStyle === 'none'
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              } ${plan === 'free' ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              기본
            </button>
            {RESPONSE_STYLES.map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedStyle(s.id)}
                disabled={plan === 'free'}
                title={s.description}
                className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                  selectedStyle === s.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                } ${plan === 'free' ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 업종 + 톤 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">업종</label>
            <Select value={businessCategory} onValueChange={(v) => setBusinessCategory(v as any)}>
              <SelectTrigger><SelectValue placeholder="업종 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">선택 안 함</SelectItem>
                {filteredBusinessCategories.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {allowedCategoryIds && (
              <p className="text-[11px] text-muted-foreground mt-1">선택한 플랫폼에 맞는 업종만 표시됩니다.</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">답변 톤</label>
            <Select value={tone} onValueChange={(v) => setTone(v as any)}>
              <SelectTrigger><SelectValue placeholder="톤 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">자동</SelectItem>
                {TONES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 리뷰 전용 */}
        {genType === 'review' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">별점</label>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} type="button" onClick={() => setReviewRating(n === reviewRating ? 0 : n)}
                    className="p-1" aria-label={`${n}점`}>
                    <Star className={`w-6 h-6 ${n <= reviewRating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">고객 닉네임 (선택)</label>
              <Input value={reviewNickname} onChange={e => setReviewNickname(e.target.value)}
                placeholder="예: 김철수" maxLength={30} />
            </div>
          </div>
        )}

        {/* 문의 전용 */}
        {genType === 'inquiry' && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">문의 카테고리</label>
              <div className="flex flex-wrap gap-2">
                {INQUIRY_CATEGORIES.map(c => (
                  <button key={c.id} type="button"
                    onClick={() => setInquiryCategory(inquiryCategory === c.id ? 'none' : c.id)}
                    className={`px-3 py-1.5 rounded-full border text-sm ${
                      inquiryCategory === c.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}>{c.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">변수 (입력하면 답변에 반영)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'ship_date', ph: '발송일 (예: 11/12)' },
                  { key: 'restock_date', ph: '재입고 예정일' },
                  { key: 'tracking_no', ph: '운송장 번호' },
                  { key: 'cs_phone', ph: 'CS 연락처' },
                  { key: 'business_hours', ph: '영업시간 (예: 평일 10-18시)' },
                ].map(s => (
                  <Input key={s.key} placeholder={s.ph} maxLength={100}
                    value={slots[s.key] || ''}
                    onChange={e => setSlots(prev => ({ ...prev, [s.key]: e.target.value }))} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 클레임 전용 */}
        {genType === 'claim' && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">심각도</label>
              <div className="flex gap-2">
                {([
                  { id: 'low', label: '낮음' },
                  { id: 'normal', label: '보통' },
                  { id: 'high', label: '높음' },
                ] as const).map(s => (
                  <button key={s.id} type="button" onClick={() => setClaimSeverity(s.id)}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                      claimSeverity === s.id ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'
                    }`}>{s.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">제안할 보상안</label>
              <div className="flex flex-wrap gap-2">
                {COMPENSATIONS.map(c => {
                  const checked = compensations.includes(c.id);
                  return (
                    <button key={c.id} type="button"
                      onClick={() => setCompensations(prev => checked ? prev.filter(x => x !== c.id) : [...prev, c.id])}
                      className={`px-3 py-1.5 rounded-full border text-sm ${
                        checked ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}>{c.label}</button>
                  );
                })}
              </div>
            </div>
            {detectedRisks.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">⚠️ 사장님 직접 검토 권장</p>
                  <p className="text-muted-foreground mt-0.5">감지된 위험 키워드: {detectedRisks.join(', ')}</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mb-2">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-foreground">내용 입력</label>
            {charLimit && (
              <span className={`text-xs ${inputText.length > charLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                {inputText.length} / {charLimit}자
              </span>
            )}
          </div>
          <Textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={genType === 'review' ? '고객 리뷰 내용을 입력하세요...' : genType === 'inquiry' ? '고객 문의 내용을 입력하세요...' : '클레임 내용을 입력하세요...'}
            rows={4}
          />
        </div>

        <label className="flex items-center gap-2 mb-4 text-sm text-muted-foreground cursor-pointer select-none">
          <input type="checkbox" checked={autoCopy} onChange={e => setAutoCopy(e.target.checked)} />
          생성 후 자동 복사
        </label>

        <div className="flex gap-3 mb-6 flex-wrap">
          <Button onClick={handleGenerate} disabled={loading || !inputText.trim() || isLimitReached} className="gradient-primary text-primary-foreground">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 생성 중...</> : <><ArrowUp className="w-4 h-4 mr-2" /> 답변 생성 (-{energyCost}⚡)</>}
          </Button>
          <div className="relative">
            <input type="file" accept="image/*" multiple={plan === 'pro'} onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isLimitReached || batchLoading} />
            <Button variant="outline" disabled={isLimitReached || batchLoading}>
              <Image className="w-4 h-4 mr-2" /> 이미지 일괄 처리
            </Button>
          </div>
          {result && (
            <Button variant="outline" onClick={saveAsTemplate}>
              <Save className="w-4 h-4 mr-2" /> 템플릿 저장
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground -mt-4 mb-6">💡 이미지를 드래그 앤 드롭하거나 Ctrl+V로 붙여넣기할 수 있습니다.</p>

        {result && (
          <GenerateResultCard result={result} onCopy={() => copyToClipboard(result)} />
        )}


        {batchLoading && (
          <div className="bg-card rounded-xl border border-border p-5 mb-6 shadow-card">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="font-medium text-foreground">이미지 처리 중... {batchProgress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="gradient-primary h-2 rounded-full transition-all" style={{ width: `${batchProgress}%` }} />
            </div>
          </div>
        )}

        {batchResults.length > 0 && (
          <BatchResultsList
            results={batchResults}
            totalExtracted={batchTotalExtracted}
            plan={plan}
            onCopy={copyToClipboard}
            onCopyAll={copyAll}
          />
        )}
      </div>
    </Layout>
  );
}

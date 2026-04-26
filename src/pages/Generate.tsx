import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ENERGY_COSTS, RESPONSE_STYLES, type ResponseStyle } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Image, Loader2, ArrowUp, AlertTriangle, Zap } from 'lucide-react';

import GenerateResultCard from '@/components/generate/GenerateResultCard';
import BatchResultsList from '@/components/generate/BatchResultsList';
import EnergyIndicator from '@/components/generate/EnergyIndicator';
import EnergyAnimation from '@/components/generate/EnergyAnimation';
import { ALL_PLATFORMS, getPlatformLabel } from '@/lib/platforms';

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
  const [selectedStyle, setSelectedStyle] = useState<ResponseStyle | 'none'>('none');
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

  const energyCost = ENERGY_COSTS[genType] || 1;
  const isLimitReached = energyBalance < energyCost;

  useEffect(() => {
    if (user) {
      supabase.from('products').select('id, name, category, note').eq('user_id', user.id).then(({ data }) => {
        if (data) setProducts(data);
      });
      supabase.from('profiles').select('platforms').eq('user_id', user.id).maybeSingle().then(({ data }) => {
        const list = (data?.platforms as string[]) || [];
        setUserPlatforms(list);
        if (list.length > 0) setSelectedPlatform(list[0]);
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
        body: { type: genType, text: inputText, product: getProductContext(), energy_cost: energyCost, style: getStylePayload(), platform: getPlatformPayload() },
      });
      if (error) throw error;
      if (!data || !data.response) throw new Error(data?.error || '답변을 생성할 수 없습니다.');
      setResult(data.response);
      setEnergyAnim({ amount: energyCost, type: 'spend' });
      await refreshEnergy();
      
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
          body: { type: genType, text: processItems[i], product, energy_cost: energyCost, style: getStylePayload() },
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

        <div className="mb-4">
          <label className="text-sm font-medium text-foreground mb-1.5 block">내용 입력</label>
          <Textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={genType === 'review' ? '고객 리뷰 내용을 입력하세요...' : genType === 'inquiry' ? '고객 문의 내용을 입력하세요...' : '클레임 내용을 입력하세요...'}
            rows={4}
          />
        </div>

        <div className="flex gap-3 mb-6">
          <Button onClick={handleGenerate} disabled={loading || !inputText.trim() || isLimitReached} className="gradient-primary text-primary-foreground">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 생성 중...</> : <><ArrowUp className="w-4 h-4 mr-2" /> 답변 생성 (-{energyCost}⚡)</>}
          </Button>
          <div className="relative">
            <input type="file" accept="image/*" multiple={plan === 'pro'} onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isLimitReached || batchLoading} />
            <Button variant="outline" disabled={isLimitReached || batchLoading}>
              <Image className="w-4 h-4 mr-2" /> 이미지 일괄 처리
            </Button>
          </div>
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

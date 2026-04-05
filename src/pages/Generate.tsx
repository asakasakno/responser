import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PLAN_LIMITS } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copy, Image, Loader2, ArrowUp, AlertTriangle, Lock, Crown } from 'lucide-react';

import GenerateResultCard from '@/components/generate/GenerateResultCard';
import BatchResultsList from '@/components/generate/BatchResultsList';
import UsageIndicator from '@/components/generate/UsageIndicator';

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
  const { user, plan } = useAuth();
  const { toast } = useToast();
  const limits = PLAN_LIMITS[plan];

  const [genType, setGenType] = useState<GenType>(initType);
  const [inputText, setInputText] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>('none');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  
  const [batchResults, setBatchResults] = useState<{ input: string; output: string }[]>([]);
  const [batchTotalExtracted, setBatchTotalExtracted] = useState(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const [todayUsage, setTodayUsage] = useState(0);
  const [usageLoading, setUsageLoading] = useState(true);

  const remaining = limits.unlimited ? Infinity : Math.max(0, limits.dailyLimit - todayUsage);
  const isLimitReached = !limits.unlimited && remaining <= 0;

  useEffect(() => {
    if (user) {
      supabase.from('products').select('id, name, category, note').eq('user_id', user.id).then(({ data }) => {
        if (data) setProducts(data);
      });
      fetchTodayUsage();
    }
  }, [user]);

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
  }, [genType, selectedProduct, isLimitReached, batchLoading, remaining, limits]);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) processImageFile(file);
  };

  const fetchTodayUsage = async () => {
    if (!user) return;
    setUsageLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    setTodayUsage(data?.count || 0);
    setUsageLoading(false);
  };

  const getProductContext = () => {
    if (selectedProduct === 'none') return null;
    const p = products.find(p => p.id === selectedProduct);
    return p ? { name: p.name, category: p.category, note: p.note } : null;
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    if (isLimitReached) {
      toast({ title: '일일 한도 초과', description: '오늘의 생성 한도를 모두 사용했습니다. 플랜을 업그레이드해주세요.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: { type: genType, text: inputText, product: getProductContext() },
      });
      if (error) throw error;
      setResult(data.response);
      setTodayUsage(prev => prev + 1);
      
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

  const processImageFile = (file: File) => {
    if (isLimitReached) {
      toast({ title: '일일 한도 초과', description: '오늘의 생성 한도를 모두 사용했습니다.', variant: 'destructive' });
      return;
    }
    setBatchResults([]);
    setBatchTotalExtracted(0);
    setBatchLoading(true);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        
        const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-from-image', {
          body: { image: base64, type: genType },
        });
        if (extractError) throw extractError;
        
        const items: string[] = extractData.items || [];
        setBatchTotalExtracted(items.length);
        
        const maxByPlan = limits.maxPerImage;
        const maxByUsage = limits.unlimited ? items.length : remaining;
        const processCount = Math.min(items.length, maxByPlan, maxByUsage);
        const processItems = items.slice(0, processCount);

        const allResults: { input: string; output: string }[] = [];
        const product = getProductContext();
        for (let i = 0; i < processItems.length; i++) {
          setBatchProgress(Math.round(((i + 1) / processItems.length) * 100));
          const { data } = await supabase.functions.invoke('generate-response', {
            body: { type: genType, text: processItems[i], product },
          });
          allResults.push({ input: processItems[i], output: data?.response || '생성 실패' });
          setTodayUsage(prev => prev + 1);
          
          await supabase.from('generations').insert({
            user_id: user!.id,
            type: genType,
            input_text: processItems[i],
            output_text: data?.response || '생성 실패',
            product_id: selectedProduct !== 'none' ? selectedProduct : null,
          });
        }

        const blurredCount = items.length - processCount;
        for (let i = 0; i < blurredCount; i++) {
          allResults.push({ input: items[processCount + i] || '', output: '__BLURRED__' });
        }

        setBatchResults(allResults);
      } catch (err: any) {
        toast({ title: '처리 실패', description: err.message, variant: 'destructive' });
      } finally {
        setBatchLoading(false);
        setBatchProgress(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
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
          <UsageIndicator
            todayUsage={todayUsage}
            dailyLimit={limits.dailyLimit}
            unlimited={limits.unlimited}
            loading={usageLoading}
          />
        </div>

        {isLimitReached && (
          <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">오늘의 생성 한도({limits.dailyLimit}회)를 모두 사용했습니다.</p>
              <p className="text-sm text-muted-foreground mt-1">
                더 많은 생성이 필요하시면{' '}
                <Link to="/pricing" className="text-primary underline font-medium">플랜을 업그레이드</Link>해주세요.
              </p>
            </div>
          </div>
        )}

        <Tabs value={genType} onValueChange={v => setGenType(v as GenType)} className="mb-6">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="review">리뷰 답변</TabsTrigger>
            <TabsTrigger value="inquiry">문의 답변</TabsTrigger>
            <TabsTrigger value="claim">클레임 대응</TabsTrigger>
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
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 생성 중...</> : <><ArrowUp className="w-4 h-4 mr-2" /> 답변 생성</>}
          </Button>
          <div className="relative">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={isLimitReached || batchLoading} />
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

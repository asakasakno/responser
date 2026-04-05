import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PLAN_LIMITS } from '@/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Copy, Image, Loader2, ArrowUp, AlertTriangle } from 'lucide-react';

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
  
  const [batchResults, setBatchResults] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [extractedCount, setExtractedCount] = useState(0);
  const [planLimitHit, setPlanLimitHit] = useState(false);

  useEffect(() => {
    if (user) {
      supabase.from('products').select('id, name, category, note').eq('user_id', user.id).then(({ data }) => {
        if (data) setProducts(data);
      });
    }
  }, [user]);

  const getProductContext = () => {
    if (selectedProduct === 'none') return null;
    const p = products.find(p => p.id === selectedProduct);
    return p ? { name: p.name, category: p.category, note: p.note } : null;
  };

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-response', {
        body: { type: genType, text: inputText, product: getProductContext() },
      });
      if (error) throw error;
      setResult(data.response);
      
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!limits.imageUpload) {
      toast({ title: '이미지 처리 불가', description: 'Basic 이상 플랜에서 가능합니다.', variant: 'destructive' });
      return;
    }
    setBatchResults([]);
    setExtractedCount(0);
    setPlanLimitHit(false);
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
        setExtractedCount(items.length);
        const maxItems = limits.maxPerImage;
        const processItems = items.slice(0, maxItems);
        if (items.length > maxItems) setPlanLimitHit(true);

        const results: string[] = [];
        const product = getProductContext();
        for (let i = 0; i < processItems.length; i++) {
          setBatchProgress(Math.round(((i + 1) / processItems.length) * 100));
          const { data } = await supabase.functions.invoke('generate-response', {
            body: { type: genType, text: processItems[i], product },
          });
          results.push(data?.response || '생성 실패');
          
          await supabase.from('generations').insert({
            user_id: user!.id,
            type: genType,
            input_text: processItems[i],
            output_text: data?.response || '생성 실패',
            product_id: selectedProduct !== 'none' ? selectedProduct : null,
          });
        }
        setBatchResults(results);
      } catch (err: any) {
        toast({ title: '처리 실패', description: err.message, variant: 'destructive' });
      } finally {
        setBatchLoading(false);
        setBatchProgress(0);
      }
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: '복사됨' });
  };

  const copyAll = () => {
    const allText = batchResults.map((r, i) => `[${i + 1}]\n${r}`).join('\n\n---\n\n');
    copyToClipboard(allText);
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-6">AI 답변 생성</h1>

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
          <Button onClick={handleGenerate} disabled={loading || !inputText.trim()} className="gradient-primary text-primary-foreground">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 생성 중...</> : <><ArrowUp className="w-4 h-4 mr-2" /> 답변 생성</>}
          </Button>
          <div className="relative">
            <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" disabled={!limits.imageUpload || batchLoading} />
            <Button variant="outline" disabled={!limits.imageUpload || batchLoading}>
              <Image className="w-4 h-4 mr-2" /> 이미지 일괄 처리
              {!limits.imageUpload && <span className="ml-2 text-xs text-muted-foreground">(Basic+)</span>}
            </Button>
          </div>
        </div>

        {result && (
          <div className="bg-card rounded-xl border border-border p-5 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">생성된 답변</h3>
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(result)}><Copy className="w-4 h-4 mr-1" /> 복사</Button>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{result}</p>
          </div>
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

        {planLimitHit && (
          <div className="bg-destructive/10 rounded-xl border border-destructive/20 p-4 mb-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">이미지에서 {extractedCount}개가 추출되었지만, 현재 플랜에서는 {limits.maxPerImage}개만 처리됩니다.</p>
              <p className="text-sm text-muted-foreground mt-1">Pro 플랜으로 업그레이드하면 최대 30개까지 처리 가능합니다.</p>
            </div>
          </div>
        )}

        {batchResults.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">일괄 처리 결과 ({batchResults.length}개)</h3>
              <Button variant="outline" size="sm" onClick={copyAll}><Copy className="w-4 h-4 mr-1" /> 전체 복사</Button>
            </div>
            <div className="space-y-3">
              {batchResults.map((r, i) => (
                <div key={i} className="bg-card rounded-lg border border-border p-4 shadow-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(r)}><Copy className="w-3.5 h-3.5" /></Button>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{r}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

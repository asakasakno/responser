import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';

interface Product {
  id: string;
  user_id: string;
  name: string;
  category: string;
  note: string | null;
  created_at: string;
}

export default function Products() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const fetchProducts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setProducts((data || []) as Product[]);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, [user]);

  const resetForm = () => {
    setName(''); setCategory(''); setNote('');
    setEditingProduct(null);
  };

  const openEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCategory(p.category);
    setNote(p.note || '');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !category.trim()) return;
    try {
      if (editingProduct) {
        await supabase.from('products').update({ name, category, note }).eq('id', editingProduct.id);
        toast({ title: '수정 완료' });
      } else {
        await supabase.from('products').insert({ user_id: user!.id, name, category, note });
        toast({ title: '등록 완료' });
      }
      resetForm();
      setDialogOpen(false);
      fetchProducts();
    } catch (err: any) {
      toast({ title: '오류', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('products').delete().eq('id', id);
    toast({ title: '삭제 완료' });
    fetchProducts();
  };

  return (
    <Layout>
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">상품 관리</h1>
            <p className="text-sm text-muted-foreground">상품을 등록하면 AI가 더 정확한 답변을 생성합니다</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> 상품 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingProduct ? '상품 수정' : '상품 등록'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">상품명</label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 유기농 꿀" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">카테고리</label>
                  <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="예: 식품" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">특이사항 (선택)</label>
                  <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="상품 관련 주의사항, 특징 등" rows={3} />
                </div>
                <Button onClick={handleSubmit} className="w-full gradient-primary text-primary-foreground">
                  {editingProduct ? '수정하기' : '등록하기'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">등록된 상품이 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">상품을 등록하면 AI 답변이 더 정확해집니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map(p => (
              <div key={p.id} className="bg-card rounded-xl border border-border p-4 shadow-card flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.category}{p.note ? ` · ${p.note}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

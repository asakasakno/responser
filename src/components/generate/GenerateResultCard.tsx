import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';

interface GenerateResultCardProps {
  result: string;
  onCopy: () => void;
}

export default function GenerateResultCard({ result, onCopy }: GenerateResultCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 mb-6 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">생성된 답변</h3>
        <Button variant="ghost" size="sm" onClick={onCopy}><Copy className="w-4 h-4 mr-1" /> 복사</Button>
      </div>
      <p className="text-sm text-foreground whitespace-pre-wrap">{result}</p>
    </div>
  );
}

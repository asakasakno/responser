import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Copy, Lock, Crown, ChevronDown, ChevronUp } from 'lucide-react';
import { PlanType } from '@/types';
import { useState } from 'react';

interface BatchResult {
  input: string;
  output: string;
}

interface BatchResultsListProps {
  results: BatchResult[];
  totalExtracted: number;
  plan: PlanType;
  onCopy: (text: string) => void;
  onCopyAll: () => void;
}

function ResultItem({ item, index, onCopy }: { item: BatchResult; index: number; onCopy: (text: string) => void }) {
  const [showInput, setShowInput] = useState(false);

  return (
    <div className="bg-card rounded-lg border border-border p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowInput(!showInput)}>
            {showInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span className="text-xs ml-1">원문</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onCopy(item.output)}><Copy className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      {showInput && (
        <div className="bg-muted/50 rounded-md p-3 mb-3 border border-border/50">
          <p className="text-xs text-muted-foreground font-medium mb-1">원문 (추출된 텍스트)</p>
          <p className="text-sm text-foreground whitespace-pre-wrap">{item.input}</p>
        </div>
      )}
      <p className="text-sm text-foreground whitespace-pre-wrap">{item.output}</p>
    </div>
  );
}

export default function BatchResultsList({ results, totalExtracted, plan, onCopy, onCopyAll }: BatchResultsListProps) {
  const realResults = results.filter(r => r.output !== '__BLURRED__');
  const blurredResults = results.filter(r => r.output === '__BLURRED__');
  const hasBlurred = blurredResults.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">
          일괄 처리 결과 ({realResults.length}/{totalExtracted}개)
        </h3>
        <Button variant="outline" size="sm" onClick={onCopyAll}><Copy className="w-4 h-4 mr-1" /> 전체 복사</Button>
      </div>
      <div className="space-y-3">
        {realResults.map((r, i) => (
          <ResultItem key={i} item={r} index={i} onCopy={onCopy} />
        ))}

        {hasBlurred && (
          <>
            {blurredResults.map((item, i) => (
              <div key={`blur-${i}`} className="relative bg-card rounded-lg border border-border p-4 shadow-card overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">#{realResults.length + i + 1}</span>
                </div>
                {item.input && (
                  <div className="bg-muted/50 rounded-md p-3 mb-3 border border-border/50">
                    <p className="text-xs text-muted-foreground font-medium mb-1">원문 (추출된 텍스트)</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{item.input}</p>
                  </div>
                )}
                <div className="blur-sm select-none pointer-events-none">
                  <p className="text-sm text-foreground">
                    안녕하세요, 고객님의 소중한 리뷰에 감사드립니다. 저희 제품을 이용해주셔서 진심으로 감사합니다. 고객님의 피드백은 저희에게 큰 힘이 됩니다.
                  </p>
                </div>
                <div className="absolute inset-0 flex items-center justify-center bg-card/60 backdrop-blur-[1px]">
                  <div className="text-center p-4">
                    <Lock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground mb-1">플랜 업그레이드 필요</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {plan === 'free'
                        ? '무료 플랜은 이미지당 5개까지 처리됩니다.'
                        : 'Basic 플랜은 이미지당 10개까지 처리됩니다.'}
                    </p>
                    <Link to="/pricing">
                      <Button size="sm" className="gradient-primary text-primary-foreground">
                        <Crown className="w-3.5 h-3.5 mr-1" /> 업그레이드
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Monitor, Copy, X, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

const SHARE_URL = 'https://xn--vk1booh7ruql6wa.com';
const STORAGE_KEY = 'mobile_pc_banner_dismissed_v1';

export default function MobilePcRecommendBanner() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  });
  const [copied, setCopied] = useState(false);

  if (!isMobile || dismissed) return null;

  const close = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      toast({ title: '링크가 복사되었어요', description: 'PC 브라우저에 붙여넣어 접속해보세요.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: '복사 실패', description: SHARE_URL, variant: 'destructive' });
    }
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-4 relative">
      <button
        onClick={close}
        aria-label="닫기"
        className="absolute top-2 right-2 p-1 rounded-md hover:bg-primary/10 text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <Monitor className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-foreground leading-relaxed">
            모바일에서도 사용할 수 있지만, <b>리뷰/문의 복사·캡처 업로드·확장프로그램</b> 사용은 PC에서 더 편합니다.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="default" className="gradient-primary text-primary-foreground">
                  <Monitor className="w-3.5 h-3.5 mr-1" /> PC 사용 안내 보기
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>PC에서 더 편하게 사용하기</DialogTitle>
                  <DialogDescription>
                    아래 단계로 PC에서 응대도우미를 더 빠르게 활용하세요.
                  </DialogDescription>
                </DialogHeader>
                <ol className="space-y-3 text-sm text-foreground list-decimal pl-5 py-2">
                  <li>PC 브라우저(Chrome 권장)에서 <b>응대도우미.com</b>에 접속합니다.</li>
                  <li>같은 계정으로 로그인합니다.</li>
                  <li>리뷰/문의 글을 <b>드래그 → 복사 → 붙여넣기</b> 또는 캡처를 그대로 <b>드래그/Ctrl+V</b>로 업로드합니다.</li>
                  <li>크롬 확장프로그램을 설치하면 쇼핑몰 화면에서 바로 답변이 생성됩니다.</li>
                </ol>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={copyLink}>
                    {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    링크 복사
                  </Button>
                  <Link to="/extension">
                    <Button size="sm" variant="outline">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> 확장프로그램 안내
                    </Button>
                  </Link>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" onClick={copyLink}>
              {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              링크 복사
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobilePcOnlyNotice({ feature }: { feature: string }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 mb-3 flex items-start gap-2 text-xs text-muted-foreground">
      <Monitor className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
      <span><b className="text-foreground">{feature}</b>은 PC에서 더 편하게 사용하실 수 있어요.</span>
    </div>
  );
}

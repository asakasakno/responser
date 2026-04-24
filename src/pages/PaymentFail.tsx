import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { XCircle, MessageSquare } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';

export default function PaymentFail() {
  const [params] = useSearchParams();
  const code = params.get('code');
  const message = params.get('message') || '결제가 취소되었거나 실패했습니다.';

  const isCancel = code === 'PAY_PROCESS_CANCELED' || code === 'USER_CANCEL';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">응대도우미</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-16 max-w-md">
        <Card className="p-8 text-center space-y-5">
          <XCircle className="w-14 h-14 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">
            {isCancel ? '결제가 취소되었습니다' : '결제에 실패했습니다'}
          </h1>
          <p className="text-sm text-muted-foreground break-keep">{message}</p>
          {code && !isCancel && (
            <p className="text-[11px] text-muted-foreground/70">에러 코드: {code}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Link to="/pricing" className="flex-1">
              <Button variant="outline" className="w-full">요금제 보기</Button>
            </Link>
            <a href="mailto:support@응대도우미.com" className="flex-1">
              <Button className="w-full">문의하기</Button>
            </a>
          </div>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}

import { Link } from 'react-router-dom';
import { MessageSquare, ShieldCheck, Lock, CreditCard } from 'lucide-react';

/**
 * 전자상거래법 제10조·정보통신망법 기반 사업자 정보 + 정책 링크 통합 푸터.
 * 모든 공개/정책/요금/대시보드 페이지에 동일하게 노출되어 토스페이먼츠 심사 및
 * 방문자 신뢰도를 확보한다. 모바일에서도 줄바꿈이 깨지지 않도록 구성.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container mx-auto px-4 py-10 space-y-6 text-sm text-muted-foreground">
        {/* 상단: 로고 + 정책/메뉴 링크 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center">
              <MessageSquare className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">응대도우미</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link to="/pricing" className="hover:text-foreground transition-colors">요금제</Link>
            <Link to="/extension" className="hover:text-foreground transition-colors">확장 프로그램</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">문의하기</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">이용약관</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">개인정보처리방침</Link>
            <Link to="/refund" className="hover:text-foreground transition-colors">환불정책</Link>
          </nav>
        </div>

        {/* 신뢰 배지 */}
        <ul className="flex flex-wrap gap-2 text-xs">
          <li className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 border border-border">
            <Lock className="w-3 h-3 text-primary" /> SSL 보안 결제
          </li>
          <li className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 border border-border">
            <CreditCard className="w-3 h-3 text-primary" /> Powered by Toss Payments
          </li>
          <li className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 border border-border">
            <ShieldCheck className="w-3 h-3 text-primary" /> Secure Cloud Infra
          </li>
        </ul>

        {/* 사업자 정보 */}
        <div className="border-t border-border pt-6 text-xs leading-relaxed space-y-1.5">
          <p className="font-semibold text-foreground text-sm">응대도우미</p>
          <p className="break-keep">
            상호: 응대도우미 <span className="mx-1.5 text-border">|</span>
            대표자: 배지훈 <span className="mx-1.5 text-border">|</span>
            사업자등록번호: 285-15-02485{' '}
            <a
              href="https://teht.hometax.go.kr/websquare/websquare.html?w2xPath=/ui/ab/a/a/UTEABAAA13.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground ml-1"
            >
              사업자정보 확인
            </a>
          </p>
          <p className="break-keep">통신판매업 신고번호: 제 2026-부산사하-0255 호</p>
          <p className="break-keep">
            사업장 소재지: 부산광역시 사하구 승학로3번길 47, 101동 2105호 (하단동, 사하 삼정그린코아 더시티)
          </p>
          <p className="break-keep">업태: 정보통신업 / 종목: 응용 소프트웨어 개발 및 공급업, 전자상거래 소매업</p>
          <p className="break-keep">
            고객센터: <a href="tel:01050979549" className="hover:text-foreground">010-5097-9549</a>{' '}
            <span className="mx-1.5 text-border">|</span>
            <a href="mailto:support@응대도우미.com" className="underline hover:text-foreground">
              support@응대도우미.com
            </a>
          </p>
          <p className="break-keep">운영시간: 평일 10:00 ~ 18:00 (주말·공휴일 휴무)</p>
          <p className="break-keep">개인정보 보호책임자: 배지훈 (support@응대도우미.com)</p>

          <p className="pt-3 text-muted-foreground/70">
            © {new Date().getFullYear()} 응대도우미. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

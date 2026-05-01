import { Link } from 'react-router-dom';
import { MessageCircle, MessageSquare } from 'lucide-react';

const KAKAO_URL = 'https://pf.kakao.com/_xexkLn'; // TODO: 실제 카카오톡 채널 URL

/**
 * 우측 하단 플로팅 문의 버튼 (카카오톡 + 자체 문의 폼).
 */
export default function FloatingContact() {
  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-2 items-end">
      <Link
        to="/contact"
        aria-label="문의하기"
        className="flex items-center gap-2 px-3 py-2.5 rounded-full bg-card border border-border shadow-lg hover:bg-secondary transition-colors text-sm font-medium text-foreground"
      >
        <MessageSquare className="w-4 h-4 text-primary" />
        문의하기
      </Link>
      <a
        href={KAKAO_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="카카오톡 문의"
        className="flex items-center gap-2 px-3 py-2.5 rounded-full shadow-lg hover:opacity-90 transition-opacity text-sm font-semibold"
        style={{ backgroundColor: '#FEE500', color: '#181600' }}
      >
        <MessageCircle className="w-4 h-4" />
        카카오톡 문의
      </a>
    </div>
  );
}

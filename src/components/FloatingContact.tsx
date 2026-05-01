import { MessageCircle } from 'lucide-react';

const KAKAO_URL = 'http://pf.kakao.com/_vXYTX/chat';

/**
 * 우측 하단 플로팅 카카오톡 문의 버튼.
 * 모바일에서는 카카오톡 앱 스킴으로 연결되며, 미설치 시 웹으로 폴백됩니다.
 */
export default function FloatingContact() {
  return (
    <a
      href={KAKAO_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="카카오톡 문의"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg hover:opacity-90 transition-opacity text-sm font-semibold"
      style={{ backgroundColor: '#FEE500', color: '#181600' }}
    >
      <MessageCircle className="w-5 h-5" />
      카카오톡 문의
    </a>
  );
}

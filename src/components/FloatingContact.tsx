import { MessageCircle } from 'lucide-react';

const KAKAO_WEB_URL = 'http://pf.kakao.com/_vXYTX';
// 카카오톡 채널 홈 ID (URL의 _vXYTX 부분)
const KAKAO_CHANNEL_ID = '_vXYTX';

/**
 * 모바일 환경에서 카카오톡 앱 스킴으로 열고, 실패 시 웹으로 폴백.
 * - iOS/Android 공통: kakaoplus://plusfriend/talk/chat/{id}
 * - 데스크톱: 새 창으로 웹 채널 채팅 페이지 오픈
 */
function openKakaoChat(e: React.MouseEvent<HTMLAnchorElement>) {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  if (!isMobile) return; // 데스크톱은 기본 동작(웹 새창)

  e.preventDefault();
  const appUrl = `kakaoplus://plusfriend/talk/chat/${KAKAO_CHANNEL_ID}`;
  const fallbackTimer = window.setTimeout(() => {
    window.location.href = KAKAO_WEB_URL;
  }, 1500);

  // 앱이 열려 페이지가 백그라운드로 가면 폴백 취소
  const onVisibility = () => {
    if (document.hidden) {
      clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  window.location.href = appUrl;
}

/**
 * 우측 하단 플로팅 카카오톡 문의 버튼.
 */
export default function FloatingContact() {
  return (
    <a
      href={KAKAO_WEB_URL}
      onClick={openKakaoChat}
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

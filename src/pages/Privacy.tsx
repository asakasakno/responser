import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" />
          홈으로
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">개인정보처리방침</h1>
        <p className="text-sm text-muted-foreground mb-8">
          응대도우미는 「개인정보보호법」 및 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」을 준수합니다.
        </p>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제1조 (목적)</h2>
            <p>응대도우미(이하 "회사")는 이용자의 개인정보를 중요시하며, 본 방침을 통해 회사가 수집하는 개인정보의 항목, 수집 목적, 이용 및 보관 기간, 파기 절차, 이용자의 권리 및 행사 방법 등을 안내합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제2조 (수집하는 개인정보 항목)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>회원가입 시 (필수):</strong> 이메일 주소, 비밀번호(암호화 저장), 이름, 휴대전화번호</li>
              <li><strong>회원가입 시 (선택):</strong> 운영 중인 판매 플랫폼, 회사명</li>
              <li><strong>유료 결제 시:</strong> 결제 수단 정보(카드사명, 결제 승인번호 등 / 카드번호는 토스페이먼츠가 직접 보관하며 회사는 보관하지 않음), 결제 금액, 결제일시</li>
              <li><strong>서비스 이용 중 자동 수집:</strong> 서비스 이용 기록, 접속 로그, IP 주소, 쿠키, 기기 정보(브라우저 종류 등)</li>
              <li><strong>AI 응답 생성 시:</strong> 사용자가 입력한 리뷰·문의·클레임 텍스트 및 이미지 (응답 생성 목적으로만 처리되며, AI 모델 학습에는 사용되지 않습니다)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제3조 (개인정보의 수집 및 이용 목적)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>회원 가입 및 관리: 본인 확인, 부정 이용 방지, 분쟁 조정을 위한 기록 보존</li>
              <li>서비스 제공: AI 답변 생성, 상품 정보 관리, 응답 에너지 잔액 관리</li>
              <li>유료 서비스 결제: 요금제 결제, 정기 결제, 환불 처리</li>
              <li>고객 지원: 문의 처리, 공지사항 및 정책 변경 안내</li>
              <li>서비스 개선: 익명 통계 분석, 오류 모니터링</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제4조 (개인정보의 보유 및 이용 기간)</h2>
            <p>회사는 수집·이용 목적이 달성된 후 해당 정보를 지체 없이 파기합니다. 단, 관계 법령에 의해 보존이 필요한 경우 아래 기간 동안 보관합니다.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>회원 정보: 회원 탈퇴 시까지 (탈퇴 즉시 파기)</li>
              <li>계약 또는 청약 철회 등에 관한 기록: 5년 (전자상거래법)</li>
              <li>대금 결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
              <li>소비자 불만 또는 분쟁 처리에 관한 기록: 3년 (전자상거래법)</li>
              <li>접속 로그·IP: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제5조 (개인정보의 제3자 제공 및 처리위탁)</h2>
            <p>회사는 이용자의 개인정보를 외부에 제공하지 않습니다. 다만 안정적인 서비스 제공을 위해 아래와 같이 일부 업무를 위탁하고 있습니다.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>토스페이먼츠 주식회사:</strong> 결제 처리 및 정기결제 관리</li>
              <li><strong>Supabase Inc.:</strong> 데이터베이스 및 인증 인프라 운영</li>
              <li><strong>Google LLC (Gemini API):</strong> AI 답변 생성 처리 (전송된 데이터는 모델 학습에 사용되지 않음)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제6조 (개인정보의 파기 절차 및 방법)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>전자적 파일 형태: 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
              <li>종이 문서: 분쇄기로 분쇄 또는 소각</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제7조 (이용자의 권리)</h2>
            <p>이용자는 언제든지 본인의 개인정보를 조회·수정할 수 있으며, "내 정보 → 회원 탈퇴"를 통해 개인정보 삭제를 요청할 수 있습니다. 탈퇴 요청 시 즉시 파기되며, 법령에 따라 보존이 필요한 정보는 해당 기간 동안만 별도로 안전하게 보관됩니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제8조 (개인정보 보호책임자 및 사업자 정보)</h2>
            <p>상호: 응대도우미 (대표자: 배지훈)</p>
            <p>사업자등록번호: 285-15-02485</p>
            <p>통신판매업 신고번호: 제 2026-부산사하-0255 호</p>
            <p>사업장 소재지: 부산광역시 사하구 승학로3번길 47, 101동 2105호 (하단동, 사하 삼정그린코아 더시티)</p>
            <p>개인정보 보호책임자: 배지훈</p>
            <p>이메일: support@응대도우미.com</p>
            <p>연락처: 010-5097-9549 (평일 10:00 ~ 18:00)</p>
          </section>

          <p className="text-xs text-muted-foreground/60 mt-8">시행일자: 2026년 4월 6일</p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

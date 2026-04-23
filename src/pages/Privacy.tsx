import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" />
          홈으로
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-8">개인정보처리방침</h1>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제1조 (목적)</h2>
            <p>응대도우미(이하 "회사")는 이용자의 개인정보를 중요시하며, 「개인정보보호법」을 준수하고 있습니다. 본 방침은 회사가 수집하는 개인정보의 항목, 수집 목적, 이용 및 보관 기간, 파기 절차 등을 안내합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제2조 (수집하는 개인정보 항목)</h2>
            <p>회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>필수항목:</strong> 이메일 주소, 비밀번호, 이름</li>
              <li><strong>선택항목:</strong> 판매 플랫폼 정보</li>
              <li><strong>자동수집항목:</strong> 서비스 이용 기록, 접속 로그, IP 주소, 쿠키</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제3조 (개인정보의 수집 및 이용 목적)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>회원 가입 및 관리: 본인 확인, 서비스 부정 이용 방지</li>
              <li>서비스 제공: AI 답변 생성, 상품 관리, 이용 기록 관리</li>
              <li>서비스 개선: 이용 통계 분석, 맞춤형 서비스 제공</li>
              <li>고객 지원: 문의 사항 처리, 공지사항 전달</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제4조 (개인정보의 보유 및 이용 기간)</h2>
            <p>회사는 개인정보 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>회원 탈퇴 시: 즉시 파기</li>
              <li>관련 법령에 의한 보존: 계약 또는 청약 철회 등에 관한 기록 (5년), 대금 결제 및 재화 등의 공급에 관한 기록 (5년), 소비자 불만 또는 분쟁 처리에 관한 기록 (3년)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제5조 (개인정보의 파기 절차 및 방법)</h2>
            <p>회사는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때 지체 없이 해당 개인정보를 파기합니다.</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>전자적 파일 형태: 복구 및 재생이 불가능한 방법으로 영구 삭제</li>
              <li>종이 문서: 분쇄기로 분쇄하거나 소각</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제6조 (이용자의 권리)</h2>
            <p>이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴를 통해 개인정보 삭제를 요청할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제7조 (개인정보 보호책임자)</h2>
            <p>성명: 배지훈</p>
            <p>이메일: support@응대도우미.com</p>
            <p>연락처: 010-5097-9549</p>
          </section>

          <p className="text-xs text-muted-foreground/60 mt-8">시행일자: 2026년 4월 6일</p>
        </div>
      </div>
    </div>
  );
}

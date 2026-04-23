import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" />
          홈으로
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-8">이용약관</h1>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제1조 (목적)</h2>
            <p>본 약관은 응대도우미(이하 "회사")가 제공하는 AI 자동 응대 서비스(이하 "서비스")의 이용 조건 및 절차, 회사와 이용자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제2조 (정의)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>"서비스"</strong>란 회사가 제공하는 AI 기반 리뷰·문의·클레임 답변 자동 생성 서비스를 말합니다.</li>
              <li><strong>"이용자"</strong>란 본 약관에 따라 서비스를 이용하는 자를 말합니다.</li>
              <li><strong>"회원"</strong>이란 회사에 회원 가입을 한 자를 말합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제3조 (약관의 효력 및 변경)</h2>
            <p>본 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다. 회사는 필요 시 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 고지합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제4조 (회원 가입 및 탈퇴)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>회원 가입은 이용자가 약관에 동의한 후 가입 양식을 작성하여 신청하면 회사가 이를 승낙함으로써 성립합니다.</li>
              <li>회원은 언제든지 설정 페이지를 통해 탈퇴를 요청할 수 있으며, 회사는 즉시 처리합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제5조 (서비스 이용)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>서비스는 회원 가입 후 이용 가능합니다.</li>
              <li>무료 플랜은 일일 5회까지 AI 답변 생성이 가능합니다.</li>
              <li>유료 플랜은 결제 후 즉시 적용되며, 플랜별 제공 기능은 요금제 페이지에서 확인할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제6조 (이용자의 의무)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>이용자는 서비스를 불법적이거나 부정한 목적으로 사용해서는 안 됩니다.</li>
              <li>이용자는 타인의 개인정보를 도용하거나 허위 정보를 등록해서는 안 됩니다.</li>
              <li>이용자는 서비스의 안정적 운영을 방해하는 행위를 해서는 안 됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제7조 (회사의 의무)</h2>
            <p>회사는 안정적인 서비스 제공을 위해 최선을 다하며, 이용자의 개인정보를 보호하기 위해 노력합니다. 서비스 장애 발생 시 신속하게 복구하도록 합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제8조 (면책 조항)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>AI가 생성한 답변의 정확성, 적절성에 대해 회사는 보증하지 않으며, 최종 확인 및 수정은 이용자의 책임입니다.</li>
              <li>천재지변, 시스템 장애 등 불가항력으로 인한 서비스 중단에 대해 회사는 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제9조 (분쟁 해결)</h2>
            <p>본 약관과 관련된 분쟁은 대한민국 법률에 따르며, 관할 법원은 회사 소재지의 법원으로 합니다.</p>
          </section>

          <p className="text-xs text-muted-foreground/60 mt-8">시행일자: 2026년 4월 6일</p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

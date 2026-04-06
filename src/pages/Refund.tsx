import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Refund() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" />
          홈으로
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-8">환불 정책</h1>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제1조 (환불 원칙)</h2>
            <p>응대도우미(이하 "회사")는 이용자의 정당한 환불 요청에 대해 관련 법령에 따라 성실히 처리합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제2조 (환불 가능 사유)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>결제 후 서비스를 전혀 이용하지 않은 경우: 전액 환불</li>
              <li>결제 후 7일 이내 환불 요청 시: 이용 횟수에 따라 일할 계산하여 환불</li>
              <li>서비스 장애로 인해 정상적인 이용이 불가능했던 경우: 해당 기간만큼 이용 기간 연장 또는 환불</li>
              <li>중복 결제가 발생한 경우: 전액 환불</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제3조 (환불 불가 사유)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>결제 후 7일이 경과하고, 서비스를 이미 상당 부분 이용한 경우</li>
              <li>이용자의 귀책 사유로 인해 서비스 이용이 제한된 경우</li>
              <li>프로모션, 할인 등 특별 조건으로 제공된 서비스의 경우 (별도 안내에 따름)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제4조 (환불 절차)</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li>설정 페이지 또는 이메일(support@responser.lovable.app)을 통해 환불을 요청합니다.</li>
              <li>회사는 요청 접수 후 3영업일 이내에 검토를 완료합니다.</li>
              <li>환불이 승인되면 원래 결제 수단으로 5~7영업일 이내에 환불됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제5조 (환불 금액 계산)</h2>
            <p>환불 금액은 다음과 같이 계산됩니다:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>월간 구독:</strong> (잔여 일수 / 총 구독 일수) × 결제 금액</li>
              <li><strong>연간 구독:</strong> (잔여 월수 / 12) × 결제 금액 (단, 이미 이용한 기간은 월 정가로 정산)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제6조 (구독 해지)</h2>
            <p>구독 해지는 설정 페이지에서 언제든지 가능합니다. 해지 후에도 현재 결제 기간이 끝날 때까지 서비스를 이용할 수 있으며, 이후 자동 결제가 중단됩니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제7조 (문의)</h2>
            <p>환불 관련 문의는 아래로 연락해 주세요.</p>
            <p>이메일: support@responser.lovable.app</p>
          </section>

          <p className="text-xs text-muted-foreground/60 mt-8">시행일자: 2026년 4월 6일</p>
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';

export default function Refund() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="container mx-auto px-4 py-12 max-w-3xl flex-1">
        <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4 mr-1" />
          홈으로
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-2">환불 및 자동결제 해지 정책</h1>
        <p className="text-sm text-muted-foreground mb-8">
          전자상거래법 및 콘텐츠산업진흥법에 근거하여 운영됩니다.
        </p>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제1조 (환불 원칙)</h2>
            <p>응대도우미(이하 "회사")는 이용자의 정당한 환불 요청에 대해 「전자상거래 등에서의 소비자보호에 관한 법률」 및 「콘텐츠산업진흥법」에 따라 성실히 처리합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제2조 (환불 가능 사유)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>결제 후 서비스를 전혀 이용하지 않은 경우 (응답 에너지 사용 0): 7일 이내 전액 환불</li>
              <li>서비스 장애로 정상 이용이 불가능했던 경우: 해당 기간 연장 또는 비례 환불</li>
              <li>중복 결제가 발생한 경우: 전액 환불</li>
              <li>회사의 귀책사유로 서비스를 제공하지 못한 경우: 잔여 기간 비례 환불</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제3조 (환불 제한 사유)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>결제 후 7일이 경과하고 응답 에너지를 일부 이상 사용한 경우 (디지털 콘텐츠 특성)</li>
              <li>에너지 추가 구매 후 일부라도 사용한 경우(잔여분만 비례 환불)</li>
              <li>이용자의 귀책사유로 서비스 이용이 제한된 경우</li>
              <li>프로모션·쿠폰 할인으로 결제된 금액 중 할인 부분</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제4조 (자동결제(정기결제) 해지)</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li><strong>해지 방법:</strong> "내 정보 → 구독 관리"에서 [구독 해지] 버튼 클릭, 또는 support@응대도우미.com / 010-5097-9549 로 요청</li>
              <li><strong>해지 시점:</strong> 해지 신청 즉시 다음 결제일부터 자동 결제가 중단됩니다.</li>
              <li><strong>해지 후 이용:</strong> 이미 결제된 기간(잔여 기간)에는 정상적으로 서비스를 이용할 수 있으며, 기간 만료 후 자동으로 무료 플랜으로 전환됩니다.</li>
              <li><strong>즉시 환불을 원하는 경우:</strong> 제2조 환불 가능 사유에 해당하는지 확인 후 처리됩니다.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제5조 (환불 절차)</h2>
            <ol className="list-decimal pl-6 space-y-1">
              <li>"내 정보" 페이지 또는 support@응대도우미.com 으로 환불 요청</li>
              <li>회사는 요청 접수 후 영업일 기준 3일 이내 검토 결과 통보</li>
              <li>승인 시 원래 결제 수단으로 5~7영업일 이내 환불 (카드 결제는 카드사 정책에 따라 추가 시일 소요)</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제6조 (환불 금액 계산)</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>월간 구독:</strong> (결제 금액) × (잔여 일수 / 총 구독 일수). 단, 사용한 응답 에너지가 월 정액 한도의 50%를 초과한 경우 환불이 제한될 수 있습니다.</li>
              <li><strong>연간 구독:</strong> 결제 금액에서 (이미 사용한 개월 수 × 월 정가) 및 위약금(잔여 결제액의 10%)을 차감한 후 환불</li>
              <li><strong>에너지 추가 구매:</strong> (결제 금액) × (잔여 에너지 / 구매 에너지)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제7조 (결제 안전성)</h2>
            <p>모든 결제는 토스페이먼츠 주식회사의 보안 결제 시스템을 통해 처리되며, 회사는 카드번호 등 결제 수단 정보를 직접 저장하지 않습니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-3">제8조 (문의)</h2>
            <p>환불·해지 관련 문의는 아래로 연락해 주세요.</p>
            <p>이메일: support@응대도우미.com</p>
            <p>전화: 010-5097-9549 (평일 10:00 ~ 18:00)</p>
          </section>

          <p className="text-xs text-muted-foreground/60 mt-8">시행일자: 2026년 4월 6일</p>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

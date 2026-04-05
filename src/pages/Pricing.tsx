import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowLeft, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PLAN_LIMITS } from '@/types';

const plans = [
  {
    key: 'free' as const,
    name: 'Free',
    price: '₩0',
    period: '영구 무료',
    description: '가볍게 시작하기',
    features: [
      { text: '텍스트 + 이미지 생성', included: true },
      { text: '일일 5회 제한', included: true },
      { text: '이미지당 최대 5개 처리 (초과분 블러)', included: true },
      { text: '상품 등록 (최대 3개)', included: true },
      { text: '생성 기록 저장', included: true },
      { text: '다중 이미지 동시 업로드', included: false },
      { text: '대량 처리', included: false },
    ],
  },
  {
    key: 'basic' as const,
    name: 'Basic',
    price: '₩9,900',
    period: '/ 월',
    description: '일반 셀러를 위한 플랜',
    popular: true,
    features: [
      { text: '텍스트 + 이미지 생성', included: true },
      { text: '일일 50회 제한', included: true },
      { text: '이미지당 최대 10개 처리 (초과분 블러)', included: true },
      { text: '상품 등록 (무제한)', included: true },
      { text: '생성 기록 저장', included: true },
      { text: '대량 처리', included: false },
    ],
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    price: '₩29,900',
    period: '/ 월',
    description: '대량 처리가 필요한 파워 셀러',
    features: [
      { text: '텍스트 + 이미지 생성', included: true },
      { text: '일일 무제한', included: true },
      { text: '이미지당 최대 30개 처리', included: true },
      { text: '상품 등록 (무제한)', included: true },
      { text: '생성 기록 저장', included: true },
      { text: '대량 처리 지원', included: true },
    ],
  },
];

export default function Pricing() {
  const { user, plan: currentPlan } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">응대도우미</span>
          </Link>
          {user ? (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">대시보드</Button>
            </Link>
          ) : (
            <Link to="/auth">
              <Button variant="ghost" size="sm">로그인</Button>
            </Link>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">합리적인 요금제</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            셀러 규모에 맞게 선택하세요. 언제든 업그레이드 가능합니다.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map(plan => {
            const isCurrent = user && currentPlan === plan.key;
            return (
              <div
                key={plan.key}
                className={`relative bg-card rounded-2xl border p-6 flex flex-col ${
                  plan.popular ? 'border-primary shadow-primary-glow' : 'border-border shadow-card'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-primary text-primary-foreground text-xs font-semibold">
                    인기
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      {f.included ? (
                        <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                      )}
                      <span className={f.included ? 'text-foreground' : 'text-muted-foreground/60'}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>현재 플랜</Button>
                ) : plan.key === 'free' ? (
                  <Link to="/auth?mode=signup" className="w-full">
                    <Button variant="outline" className="w-full">무료로 시작</Button>
                  </Link>
                ) : (
                  <Link to={user ? `/checkout?plan=${plan.key}` : '/auth?mode=signup'} className="w-full">
                    <Button className={`w-full ${plan.popular ? 'gradient-primary text-primary-foreground' : ''}`}>
                      {user ? '업그레이드' : '시작하기'}
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8 text-foreground">기능 비교표</h2>
          <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="text-left p-4 text-sm font-semibold text-foreground">기능</th>
                  <th className="text-center p-4 text-sm font-semibold text-muted-foreground">Free</th>
                  <th className="text-center p-4 text-sm font-semibold text-primary">Basic</th>
                  <th className="text-center p-4 text-sm font-semibold text-accent">Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['텍스트 입력 생성', true, true, true],
                  ['리뷰 답변', true, true, true],
                  ['문의 답변', true, true, true],
                  ['클레임 대응', true, true, true],
                  ['일일 생성 횟수', '5회', '50회', '무제한'],
                  ['이미지 캡처 업로드', true, true, true],
                  ['이미지당 최대 처리', '5개', '10개', '30개'],
                  ['초과분 블러 미리보기', true, true, false],
                  ['상품 등록', '3개', '무제한', '무제한'],
                  ['생성 기록 저장', true, true, true],
                  ['대량 처리', false, false, true],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="p-4 text-sm text-foreground">{row[0] as string}</td>
                    {[1, 2, 3].map(j => (
                      <td key={j} className="p-4 text-center text-sm">
                        {typeof row[j] === 'boolean' ? (
                          row[j] ? <Check className="w-4 h-4 text-accent mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        ) : (
                          <span className="text-foreground font-medium">{row[j] as string}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

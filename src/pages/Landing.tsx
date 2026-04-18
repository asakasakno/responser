import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  MessageSquare,
  Image,
  Images,
  Zap,
  ArrowRight,
  Check,
  X,
  Upload,
  FileText,
  Copy,
  Clock,
  Users,
  Star,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

/* ── Demo data ── */
const demoExamples = [
  {
    type: '리뷰',
    badge: 'bg-primary/10 text-primary',
    input: '배송은 빨랐는데 포장이 조금 아쉬웠어요.',
    output:
      '소중한 후기 감사합니다. 포장 부분에서 아쉬움을 드려 죄송합니다. 앞으로 더 만족스러운 서비스로 보답하겠습니다.',
  },
  {
    type: '문의',
    badge: 'bg-accent/10 text-accent',
    input: '오늘 주문하면 언제 도착하나요?',
    output:
      '문의 감사합니다. 오늘 주문해주시면 보통 1~2일 내 출고되며 지역에 따라 배송 일정이 달라질 수 있습니다.',
  },
  {
    type: '클레임',
    badge: 'bg-destructive/10 text-destructive',
    input: '상품이 파손돼서 왔습니다.',
    output:
      '불편을 드려 정말 죄송합니다. 파손 상태를 확인할 수 있도록 사진을 보내주시면 빠르게 교환 또는 환불 절차를 안내드리겠습니다.',
  },
];

const comparisonRows = [
  { label: '리뷰 확인', old: '직접 읽기', now: '이미지 업로드' },
  { label: '답변 작성', old: '직접 타이핑', now: 'AI 초안 생성' },
  { label: '여러 건 처리', old: '하나씩 반복 복붙', now: '한 번에 일괄 생성' },
  { label: '응대 시간', old: '건당 3~5분', now: '건당 10초' },
];

const plans = [
  {
    name: 'Free',
    price: '₩0',
    period: '영구 무료',
    desc: '가볍게 체험해보세요',
    features: ['일일 5회 생성', '텍스트 입력', '이미지 업로드 (5개까지)', '상품 3개 등록', '생성 기록 저장'],
    cta: '무료로 시작하기',
    style: 'border-border',
  },
  {
    name: 'Basic',
    price: '₩9,900',
    period: '/ 월',
    desc: '소규모 셀러를 위한 플랜',
    popular: true,
    features: ['일일 50회 생성', '이미지 업로드 (10개까지)', '상품 무제한 등록', '생성 기록 저장'],
    cta: '시작하기',
    style: 'border-primary shadow-primary-glow',
  },
  {
    name: 'Pro',
    price: '₩29,900',
    period: '/ 월',
    desc: '대량 처리가 필요한 파워 셀러',
    features: ['일일 무제한 생성', '이미지 업로드 (30개까지)', '다중 이미지 동시 업로드', '상품 무제한 등록', '대량 일괄 처리'],
    cta: '시작하기',
    style: 'border-border',
  },
];

const testimonials = [
  {
    name: '김*영',
    role: '스마트스토어 셀러',
    text: '리뷰 답변 쓰는 데 매일 1시간씩 걸렸는데, 이제 10분이면 끝나요.',
    stars: 5,
  },
  {
    name: '이*준',
    role: '쿠팡 판매자',
    text: '클레임 답변이 제일 스트레스였는데 초안이 바로 나오니까 부담이 확 줄었습니다.',
    stars: 5,
  },
  {
    name: '박*희',
    role: '자영업자',
    text: '이미지 캡처로 한 번에 처리하는 기능이 정말 편해요. 강추합니다.',
    stars: 5,
  },
];

/* ── Page ── */
export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ========== HEADER ========== */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-14 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">응대도우미</span>
          </Link>
          <div className="flex items-center gap-2">
            <a href="#pricing">
              <Button variant="ghost" size="sm">요금제</Button>
            </a>
            <Link to="/extension">
              <Button variant="ghost" size="sm">확장 프로그램</Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm">로그인</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="gradient-primary text-primary-foreground shadow-primary-glow">
                무료로 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ========== HERO ========== */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              스마트스토어 · 쿠팡 셀러를 위한 AI 답변 생성 도구
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-5">
              리뷰 · 문의 · 클레임 답변,
              <br />
              <span className="text-primary">AI로 빠르게 생성하세요</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8 leading-relaxed">
              이미지 캡처 또는 텍스트 입력만으로
              <br className="hidden md:block" />
              리뷰, 문의, 클레임 답변을 빠르게 작성할 수 있는 AI 응대 작성 도구
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth?mode=signup">
                <Button size="lg" className="gradient-primary text-primary-foreground shadow-primary-glow text-base px-8 w-full sm:w-auto">
                  무료로 시작하기 <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <a href="#demo">
                <Button size="lg" variant="outline" className="text-base w-full sm:w-auto">
                  데모 보기 <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </a>
            </div>

            {/* Quick summary strip */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-accent" /> 회원가입 후 바로 사용</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-accent" /> 무료 플랜 제공</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-accent" /> 설치 없이 웹에서 사용</span>
            </div>
          </div>
        </div>
      </section>

      {/* ========== 핵심 기능 3가지 ========== */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">핵심 기능</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-md mx-auto">
            답변 작성에 필요한 기능만 담았습니다
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: Upload,
                title: '이미지 업로드 → 텍스트 추출',
                desc: '리뷰 캡처나 문의 화면을 업로드하면 내용을 자동으로 정리합니다.',
                accent: 'bg-primary/10 text-primary',
              },
              {
                icon: FileText,
                title: '답변 자동 생성',
                desc: '리뷰, 문의, 클레임 상황에 맞는 답변을 AI가 자연스럽게 작성합니다.',
                accent: 'bg-accent/10 text-accent',
              },
              {
                icon: Copy,
                title: '여러 개 한 번에 처리',
                desc: '여러 리뷰와 문의를 한 번에 입력하고 각각의 답변을 빠르게 생성합니다.',
                accent: 'bg-primary/10 text-primary',
              },
              {
                icon: Images,
                title: '다중 이미지 동시 업로드',
                desc: '여러 장의 이미지를 한번에 드래그 앤 드롭으로 올려 일괄 처리할 수 있습니다.',
                accent: 'bg-accent/10 text-accent',
                badge: 'Pro',
              },
            ].map((f, i) => (
              <div key={i} className="bg-card rounded-xl p-6 border border-border shadow-card hover:shadow-elevated transition-shadow relative">
                {('badge' in f && f.badge) && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full gradient-primary text-primary-foreground">
                    {f.badge}
                  </span>
                )}
                <div className={`w-11 h-11 rounded-lg ${f.accent} flex items-center justify-center mb-4`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center mt-10">
            <Link to="/auth?mode=signup">
              <Button className="gradient-primary text-primary-foreground shadow-primary-glow">
                지금 답변 생성하기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== 데모 섹션 ========== */}
      <section id="demo" className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">이렇게 사용합니다</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-md mx-auto">
            고객 메시지를 입력하면 AI가 답변 초안을 바로 생성합니다
          </p>
          <div className="max-w-3xl mx-auto space-y-6">
            {demoExamples.map((d, i) => (
              <div key={i} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-secondary/40">
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${d.badge}`}>{d.type}</span>
                </div>
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                  {/* Input */}
                  <div className="p-5">
                    <p className="text-xs font-medium text-muted-foreground mb-2">고객 메시지</p>
                    <p className="text-sm leading-relaxed bg-secondary/50 rounded-lg p-3">{d.input}</p>
                  </div>
                  {/* Output */}
                  <div className="p-5">
                    <p className="text-xs font-medium text-primary mb-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI 생성 답변
                    </p>
                    <p className="text-sm leading-relaxed bg-primary/5 rounded-lg p-3 border border-primary/10">{d.output}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-primary-glow text-base px-8">
                데모 체험하기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== 차별점 비교표 ========== */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">기존 방식 vs 응대도우미</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-md mx-auto">
            반복 복붙 없이, 답변 작성 시간을 확 줄여보세요
          </p>
          <div className="max-w-2xl mx-auto bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="grid grid-cols-3 text-center text-sm font-semibold border-b border-border bg-secondary/40">
              <div className="p-4"></div>
              <div className="p-4 text-muted-foreground">기존 방식</div>
              <div className="p-4 text-primary">응대도우미</div>
            </div>
            {comparisonRows.map((r, i) => (
              <div key={i} className="grid grid-cols-3 text-center text-sm border-b border-border last:border-0">
                <div className="p-4 text-left font-medium">{r.label}</div>
                <div className="p-4 text-muted-foreground">{r.old}</div>
                <div className="p-4 text-primary font-medium">{r.now}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 이런 분들께 추천 ========== */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">이런 분들께 추천합니다</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-md mx-auto">
            반복 응대에 시간을 쓰고 계신다면, 응대도우미가 도와드립니다
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl mx-auto">
            {[
              { icon: Users, text: '스마트스토어 셀러' },
              { icon: Users, text: '쿠팡 판매자' },
              { icon: MessageSquare, text: '리뷰 응대가 많은 자영업자' },
              { icon: Clock, text: '문의 답변이 반복되는 운영자' },
            ].map((t, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 text-center shadow-card">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <t.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-sm font-medium">{t.text}</p>
              </div>
            ))}
          </div>

          {/* 기대 효과 */}
          <div className="mt-12 max-w-2xl mx-auto grid sm:grid-cols-3 gap-5 text-center">
            {[
              { val: '최대 80%', label: '응대 시간 절감' },
              { val: '↓ 스트레스', label: '답변 작성 부담 감소' },
              { val: '↑ 속도', label: '응대 속도 향상' },
            ].map((e, i) => (
              <div key={i} className="bg-secondary/60 rounded-xl p-5">
                <p className="text-2xl font-extrabold text-primary mb-1">{e.val}</p>
                <p className="text-sm text-muted-foreground">{e.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 후기 ========== */}
      <section className="py-16 bg-secondary/50">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">사용자 후기</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-6 shadow-card">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-4">"{t.text}"</p>
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{t.name}</span> · {t.role}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 요금제 ========== */}
      <section id="pricing" className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-3">요금제</h2>
          <p className="text-center text-muted-foreground mb-10 max-w-md mx-auto">
            무료 플랜으로 바로 시작하고, 필요할 때 업그레이드하세요
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {plans.map((p, i) => (
              <div
                key={i}
                className={`relative bg-card rounded-2xl border p-6 flex flex-col ${p.style}`}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full gradient-primary text-primary-foreground text-xs font-semibold">
                    가장 인기
                  </div>
                )}
                <h3 className="text-lg font-bold mb-1">{p.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{p.desc}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl font-extrabold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth?mode=signup" className="w-full">
                  <Button
                    className={`w-full ${p.popular ? 'gradient-primary text-primary-foreground shadow-primary-glow' : ''}`}
                    variant={p.popular ? 'default' : 'outline'}
                  >
                    {p.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== 최종 CTA ========== */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-4">
            지금 바로 답변 생성을 시작해보세요
          </h2>
          <p className="text-primary-foreground/70 mb-8 max-w-md mx-auto">
            무료 플랜으로 바로 사용할 수 있습니다. 설치 없이 웹에서 시작하세요.
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90 text-base px-8 font-semibold">
              무료로 시작하기 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center">
              <MessageSquare className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">응대도우미</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link to="/pricing" className="hover:text-foreground transition-colors">요금제</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">개인정보처리방침</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">이용약관</Link>
            <Link to="/refund" className="hover:text-foreground transition-colors">환불정책</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">로그인</Link>
          </div>
          <span>© 2026 응대도우미. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

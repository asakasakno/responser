import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, Image, Zap, Shield, ArrowRight, Check } from 'lucide-react';

const features = [
  { icon: MessageSquare, title: '리뷰 · 문의 · 클레임 자동 응대', desc: 'AI가 상황에 맞는 전문적인 답변을 즉시 생성합니다' },
  { icon: Image, title: '이미지 캡처 일괄 처리', desc: '스크린샷 한 장으로 수십 개 리뷰를 한 번에 처리합니다' },
  { icon: Zap, title: '상품 맞춤 답변', desc: '등록된 상품 정보로 더 정확한 답변을 생성합니다' },
  { icon: Shield, title: '클레임 대응 전략', desc: '민감한 클레임도 전문적이고 안전하게 대응합니다' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">응대도우미</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/pricing">
              <Button variant="ghost" size="sm">요금제</Button>
            </Link>
            <Link to="/auth">
              <Button variant="ghost" size="sm">로그인</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="gradient-primary text-primary-foreground shadow-primary-glow">
                무료 시작하기
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="gradient-hero py-24 md:py-32">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            스마트스토어 셀러를 위한 AI 자동 응대
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold text-primary-foreground leading-tight mb-6 max-w-3xl mx-auto">
            하루 100개 리뷰,<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'var(--gradient-accent)' }}>
              복붙 없이 자동으로
            </span>
          </h1>
          <p className="text-lg text-primary-foreground/70 max-w-xl mx-auto mb-10">
            리뷰 · 문의 · 클레임 답변을 AI가 생성합니다.<br />
            이미지 캡처 한 장으로 수십 개를 한 번에 처리하세요.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-primary-glow text-base px-8">
                무료로 시작하기 <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 text-base">
                요금제 보기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4 text-foreground">왜 응대도우미인가요?</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
            반복적인 고객 응대에 소모되는 시간을 줄이고, 매출에 집중하세요.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-shadow border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-secondary">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">3단계로 끝나는 자동 응대</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[
              { step: '1', title: '리뷰/문의 입력', desc: '텍스트를 직접 입력하거나 이미지를 캡처해서 업로드하세요' },
              { step: '2', title: 'AI 답변 생성', desc: '상품 정보와 상황에 맞는 최적의 답변이 자동 생성됩니다' },
              { step: '3', title: '복사 & 붙여넣기', desc: '생성된 답변을 그대로 스마트스토어에 붙여넣기 하면 끝!' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full gradient-primary text-primary-foreground font-bold text-lg flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-foreground">지금 바로 시작하세요</h2>
          <p className="text-muted-foreground mb-8">무료 플랜으로 바로 사용해볼 수 있습니다</p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="gradient-primary text-primary-foreground shadow-primary-glow text-base px-8">
              무료로 시작하기 <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 응대도우미. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

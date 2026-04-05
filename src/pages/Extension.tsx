import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare, Download, Chrome, CheckCircle2, ArrowRight, MonitorSmartphone, Mouse, Image, ClipboardPaste } from 'lucide-react';

const steps = [
  { num: 1, text: '아래 버튼으로 ZIP 파일을 다운로드합니다.' },
  { num: 2, text: '다운로드한 파일의 압축을 해제합니다.' },
  { num: 3, text: 'Chrome 주소창에 chrome://extensions 를 입력합니다.' },
  { num: 4, text: '우측 상단의 "개발자 모드"를 켭니다.' },
  { num: 5, text: '"압축해제된 확장 프로그램을 로드합니다"를 클릭하고 압축 해제한 폴더를 선택합니다.' },
];

const features = [
  { icon: ClipboardPaste, title: '팝업에서 빠르게 사용', desc: '확장 아이콘 클릭 → 텍스트 입력 또는 이미지 붙여넣기로 바로 답변 생성' },
  { icon: Mouse, title: '우클릭 → 답변 생성', desc: '웹페이지에서 리뷰 텍스트를 드래그 선택 후 우클릭 메뉴로 바로 생성' },
  { icon: Image, title: '페이지 캡처 일괄 처리', desc: '현재 보고 있는 페이지를 캡처해서 리뷰를 추출하고 한번에 답변 생성' },
  { icon: MonitorSmartphone, title: '어디서든 사용', desc: '스마트스토어, 쿠팡 등 어느 페이지에서든 바로 사용 가능' },
];

export default function ExtensionPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    fetch('/extension.zip')
      .then(res => {
        if (!res.ok) throw new Error('다운로드 실패');
        return res.blob();
      })
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '응대도우미-extension.zip';
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(err => alert(err.message))
      .finally(() => setDownloading(false));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">응대도우미</span>
          </Link>
          <Link to="/dashboard">
            <Button variant="ghost" size="sm">대시보드</Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-16 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Chrome className="w-4 h-4" />
            Chrome 확장 프로그램
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4">
            어디서든 바로 답변을 생성하세요
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            스마트스토어, 쿠팡 등 리뷰 페이지에서 바로 AI 답변을 생성할 수 있는 Chrome 확장 프로그램입니다.
          </p>
          <Button size="lg" onClick={handleDownload} disabled={downloading} className="gradient-primary text-primary-foreground shadow-primary-glow text-base px-8">
            <Download className="w-5 h-5 mr-2" />
            {downloading ? '다운로드 중...' : '확장 프로그램 다운로드'}
          </Button>
        </div>

        {/* Features */}
        <div className="grid sm:grid-cols-2 gap-6 mb-16">
          {features.map((f, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-6 shadow-card">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2 text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Install Steps */}
        <div className="bg-card rounded-2xl border border-border p-8 shadow-card">
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">설치 방법</h2>
          <div className="space-y-4">
            {steps.map(s => (
              <div key={s.num} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {s.num}
                </div>
                <p className="text-sm text-foreground pt-1.5 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-6 text-center">
            Chrome, Edge, Brave, Arc 등 모든 Chromium 기반 브라우저에서 사용 가능합니다.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link to="/auth?mode=signup">
            <Button variant="outline" size="lg">
              아직 계정이 없으신가요? 무료로 시작하기 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

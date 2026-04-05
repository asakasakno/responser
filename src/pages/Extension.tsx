import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageSquare, Download, Chrome, ArrowRight, MonitorSmartphone,
  Mouse, Image, ClipboardPaste, FolderOpen, ToggleRight, Upload,
  Puzzle, Pin, Type, Camera, Clipboard, Copy, MousePointerClick,
  Monitor, Search, FileText, Sparkles, CheckCircle2, AlertCircle
} from 'lucide-react';

/* ───── Install Steps with icons & detailed sub-text ───── */
const installSteps = [
  {
    num: 1,
    icon: Download,
    title: 'ZIP 파일 다운로드',
    desc: '이 페이지의 다운로드 버튼을 클릭하여 확장 프로그램 ZIP 파일을 받습니다.',
    tip: null,
  },
  {
    num: 2,
    icon: FolderOpen,
    title: '압축 해제',
    desc: '다운로드한 ZIP 파일을 우클릭 → "압축 풀기"로 폴더를 만듭니다.',
    tip: '💡 압축 해제한 폴더는 삭제하지 마세요! 삭제하면 확장이 비활성화됩니다.',
  },
  {
    num: 3,
    icon: Search,
    title: 'Chrome 확장 관리 페이지 열기',
    desc: 'Chrome 주소창에 아래 주소를 입력하고 Enter를 누릅니다.',
    tip: 'chrome://extensions',
  },
  {
    num: 4,
    icon: ToggleRight,
    title: '개발자 모드 켜기',
    desc: '확장 관리 페이지 우측 상단의 "개발자 모드" 토글을 ON으로 전환합니다.',
    tip: null,
  },
  {
    num: 5,
    icon: Upload,
    title: '확장 프로그램 로드',
    desc: '"압축해제된 확장 프로그램을 로드합니다" 버튼을 클릭한 뒤, 2단계에서 압축 해제한 폴더를 선택합니다.',
    tip: null,
  },
  {
    num: 6,
    icon: Pin,
    title: '확장 프로그램 고정 (선택)',
    desc: 'Chrome 상단 퍼즐 아이콘(🧩)을 클릭 → "응대도우미" 옆 📌 핀을 눌러 고정하면 항상 보입니다.',
    tip: '💡 고정하면 주소창 옆에 아이콘이 항상 표시되어 빠르게 접근할 수 있어요!',
  },
];

/* ───── Features ───── */
const features = [
  { icon: ClipboardPaste, title: '팝업에서 빠르게 사용', desc: '확장 아이콘 클릭 → 텍스트 입력 또는 이미지 붙여넣기로 바로 답변 생성' },
  { icon: Mouse, title: '우클릭 → 답변 생성', desc: '웹페이지에서 리뷰 텍스트를 드래그 선택 후 우클릭 메뉴로 바로 생성' },
  { icon: Image, title: '페이지 캡처 일괄 처리', desc: '현재 보고 있는 페이지를 캡처해서 리뷰를 추출하고 한번에 답변 생성' },
  { icon: MonitorSmartphone, title: '어디서든 사용', desc: '스마트스토어, 쿠팡 등 어느 페이지에서든 바로 사용 가능' },
];

/* ───── Usage Guide ───── */
const usageGuides = [
  {
    id: 'popup',
    label: '팝업 사용',
    icon: MessageSquare,
    steps: [
      { icon: Puzzle, text: 'Chrome 상단의 응대도우미 아이콘을 클릭합니다.' },
      { icon: Type, text: '리뷰 텍스트를 직접 입력하거나, 이미지를 Ctrl+V로 붙여넣기 합니다.' },
      { icon: Sparkles, text: '"답변 생성" 버튼을 클릭하면 AI가 자동으로 답변을 만들어 줍니다.' },
      { icon: Copy, text: '"복사" 버튼을 눌러 생성된 답변을 클립보드에 복사합니다.' },
      { icon: Clipboard, text: '답변이 필요한 곳에 Ctrl+V로 붙여넣기 하면 끝!' },
    ],
  },
  {
    id: 'context',
    label: '우클릭 메뉴',
    icon: Mouse,
    steps: [
      { icon: MousePointerClick, text: '웹페이지에서 답변할 리뷰 텍스트를 마우스로 드래그하여 선택합니다.' },
      { icon: Mouse, text: '선택한 텍스트 위에서 마우스 우클릭을 합니다.' },
      { icon: Sparkles, text: '메뉴에서 "응대도우미로 답변 생성"을 클릭합니다.' },
      { icon: AlertCircle, text: '잠시 후 팝업이 열리며 생성된 답변을 확인할 수 있습니다.' },
      { icon: Copy, text: '답변을 복사하여 리뷰 답변란에 붙여넣기 합니다.' },
    ],
  },
  {
    id: 'capture',
    label: '페이지 캡처',
    icon: Camera,
    steps: [
      { icon: Monitor, text: '답변할 리뷰가 있는 페이지(스마트스토어, 쿠팡 등)를 엽니다.' },
      { icon: Puzzle, text: '응대도우미 팝업을 열고 "페이지 캡처" 버튼을 클릭합니다.' },
      { icon: Camera, text: '현재 화면이 자동으로 캡처되고, AI가 리뷰를 추출합니다.' },
      { icon: FileText, text: '추출된 리뷰 목록을 확인하고, 각 리뷰에 대한 답변이 일괄 생성됩니다.' },
      { icon: CheckCircle2, text: '각 답변의 복사 버튼으로 필요한 답변을 바로 사용하세요.' },
    ],
  },
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
      {/* Header */}
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

      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-20">
        {/* ── Hero ── */}
        <div className="text-center">
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

        {/* ── Features ── */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">주요 기능</h2>
          <div className="grid sm:grid-cols-2 gap-6">
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
        </div>

        {/* ── Install Steps (visual) ── */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">설치 방법</h2>
          <p className="text-muted-foreground text-center mb-10 text-sm">총 5분이면 완료! 아래 단계를 따라하세요.</p>

          <div className="relative space-y-0">
            {installSteps.map((s, idx) => (
              <div key={s.num} className="relative flex gap-5">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center text-lg font-bold flex-shrink-0 shadow-lg z-10">
                    <s.icon className="w-5 h-5" />
                  </div>
                  {idx < installSteps.length - 1 && (
                    <div className="w-0.5 flex-1 bg-border my-1" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8 pt-1 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">STEP {s.num}</span>
                  </div>
                  <h3 className="font-bold text-foreground text-base mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                  {s.tip && (
                    <div className="mt-2 bg-muted/50 border border-border rounded-lg px-4 py-2.5 text-xs text-muted-foreground">
                      {s.tip.startsWith('chrome://') ? (
                        <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono text-xs">{s.tip}</code>
                      ) : (
                        s.tip
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 rounded-xl border border-border p-4 text-center mt-4">
            <p className="text-xs text-muted-foreground">
              ✅ Chrome, Edge, Brave, Arc 등 <strong className="text-foreground">모든 Chromium 기반 브라우저</strong>에서 동일하게 사용 가능합니다.
            </p>
          </div>
        </div>

        {/* ── Usage Guide (tabs) ── */}
        <div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">사용 방법</h2>
          <p className="text-muted-foreground text-center mb-8 text-sm">3가지 방법으로 답변을 생성할 수 있어요.</p>

          <Tabs defaultValue="popup" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-6 h-auto">
              {usageGuides.map(g => (
                <TabsTrigger key={g.id} value={g.id} className="flex items-center gap-2 py-3 text-sm">
                  <g.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{g.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {usageGuides.map(g => (
              <TabsContent key={g.id} value={g.id}>
                <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-card">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <g.icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">{g.label}</h3>
                  </div>

                  <div className="space-y-0">
                    {g.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 relative">
                        {/* Connector */}
                        <div className="flex flex-col items-center">
                          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                            <step.icon className="w-4 h-4 text-primary" />
                          </div>
                          {idx < g.steps.length - 1 && (
                            <div className="w-0.5 flex-1 bg-border my-1" />
                          )}
                        </div>
                        <div className="pb-5 pt-2 flex-1">
                          <p className="text-sm text-foreground leading-relaxed">{step.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* ── FAQ / Tips ── */}
        <div className="bg-card rounded-2xl border border-border p-6 md:p-8 shadow-card">
          <h2 className="text-xl font-bold text-foreground mb-6 text-center">자주 묻는 질문</h2>
          <div className="space-y-6">
            {[
              { q: '로그인은 어떻게 하나요?', a: '확장 프로그램 팝업에서 응대도우미 계정(이메일/비밀번호)으로 로그인합니다. 아직 계정이 없다면 먼저 회원가입을 해주세요.' },
              { q: '확장 프로그램 업데이트는 어떻게 하나요?', a: '새 ZIP 파일을 다운로드한 뒤, 기존 폴더에 덮어쓰고 chrome://extensions에서 🔄 새로고침 버튼을 클릭하면 됩니다.' },
              { q: '다른 브라우저에서도 사용 가능한가요?', a: 'Edge, Brave, Arc, Opera 등 모든 Chromium 기반 브라우저에서 동일한 방법으로 설치 및 사용 가능합니다.' },
              { q: '사용량은 웹과 공유되나요?', a: '네, 확장 프로그램에서 생성한 답변도 동일한 계정의 일일 사용량에 포함됩니다.' },
            ].map((item, i) => (
              <div key={i}>
                <h4 className="font-semibold text-foreground text-sm mb-1">Q. {item.q}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">A. {item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="text-center">
          <Button size="lg" onClick={handleDownload} disabled={downloading} className="gradient-primary text-primary-foreground shadow-primary-glow text-base px-8 mb-4">
            <Download className="w-5 h-5 mr-2" />
            {downloading ? '다운로드 중...' : '지금 바로 다운로드'}
          </Button>
          <div className="mt-4">
            <Link to="/auth?mode=signup">
              <Button variant="outline" size="lg">
                아직 계정이 없으신가요? 무료로 시작하기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

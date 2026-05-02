/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="ko" dir="ltr">
    <Head />
    <Preview>10초만에 시작하는 고객응대 자동화 — 이메일 인증을 완료해주세요</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header */}
        <Section style={header}>
          <Heading style={brand}>응대도우미</Heading>
          <Text style={tagline}>
            리뷰 · 문의 · 클레임 답변을 AI가 대신 작성합니다
          </Text>
        </Section>

        {/* Hero */}
        <Section style={heroSection}>
          <Heading style={h1}>
            10초만에 시작하세요 🚀
          </Heading>
          <Text style={lead}>
            매일 반복되는 답변, 이제 그만.<br />
            응대도우미가 사장님의 시간을 돌려드립니다.
          </Text>
        </Section>

        {/* CTA */}
        <Section style={ctaSection}>
          <Text style={text}>
            아래 버튼을 눌러 이메일 인증을 완료하면 바로 사용할 수 있어요.
          </Text>
          <Button style={button} href={confirmationUrl}>
            이메일 인증하고 시작하기
          </Button>
          <Text style={smallText}>
            가입한 이메일:{' '}
            <Link href={`mailto:${recipient}`} style={link}>
              {recipient}
            </Link>
          </Text>
        </Section>

        <Hr style={hr} />

        {/* Trust signals */}
        <Section style={trustSection}>
          <Text style={trustItem}>✅ 이미 많은 사장님이 사용 중</Text>
          <Text style={trustItem}>✅ 설치 없이 웹에서 바로 사용</Text>
          <Text style={trustItem}>✅ 무료 플랜 제공 — 카드 등록 불필요</Text>
        </Section>

        <Hr style={hr} />

        {/* Footer */}
        <Section>
          <Text style={footer}>
            본인이 요청하지 않았다면 이 메일은 무시하셔도 됩니다.
          </Text>
          <Text style={footer}>
            <Link href={siteUrl} style={footerLink}>
              {siteName}
            </Link>{' '}
            · 셀러를 위한 AI 응대 자동화
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: 0,
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}
const header = {
  textAlign: 'center' as const,
  paddingBottom: '24px',
}
const brand = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#3B82F6',
  margin: '0 0 8px',
  letterSpacing: '-0.5px',
}
const tagline = {
  fontSize: '13px',
  color: '#6B7280',
  margin: 0,
}
const heroSection = {
  textAlign: 'center' as const,
  padding: '24px 0 8px',
}
const h1 = {
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#111827',
  margin: '0 0 16px',
  lineHeight: '1.3',
}
const lead = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const ctaSection = {
  textAlign: 'center' as const,
  padding: '24px 0 8px',
}
const text = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 20px',
  textAlign: 'center' as const,
}
const button = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
  backgroundColor: '#3B82F6',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  borderRadius: '12px',
  padding: '16px 32px',
  textDecoration: 'none',
  margin: '0 0 16px',
}
const smallText = {
  fontSize: '13px',
  color: '#6B7280',
  margin: '12px 0 0',
}
const link = { color: '#3B82F6', textDecoration: 'underline' }
const hr = {
  borderColor: '#E5E7EB',
  margin: '32px 0',
}
const trustSection = {
  padding: '0 8px',
}
const trustItem = {
  fontSize: '14px',
  color: '#374151',
  margin: '0 0 8px',
  lineHeight: '1.5',
}
const footer = {
  fontSize: '12px',
  color: '#9CA3AF',
  textAlign: 'center' as const,
  margin: '0 0 8px',
  lineHeight: '1.5',
}
const footerLink = {
  color: '#6B7280',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}

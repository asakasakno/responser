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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="ko" dir="ltr">
    <Head />
    <Preview>{siteName} 비밀번호를 재설정해주세요</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>응대도우미</Heading>
        </Section>

        <Heading style={h1}>비밀번호 재설정</Heading>
        <Text style={text}>
          {siteName} 계정의 비밀번호 재설정 요청을 받았어요.<br />
          아래 버튼을 눌러 새 비밀번호를 설정해주세요.
        </Text>

        <Section style={ctaSection}>
          <Button style={button} href={confirmationUrl}>
            비밀번호 재설정하기
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          본인이 요청하지 않았다면 이 메일은 무시하셔도 됩니다.<br />
          비밀번호는 변경되지 않습니다.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Segoe UI", Roboto, sans-serif',
}
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const header = { textAlign: 'center' as const, paddingBottom: '24px' }
const brand = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#3B82F6',
  margin: 0,
  letterSpacing: '-0.5px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#111827',
  margin: '0 0 16px',
  textAlign: 'center' as const,
}
const text = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}
const ctaSection = { textAlign: 'center' as const, padding: '8px 0 16px' }
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
}
const hr = { borderColor: '#E5E7EB', margin: '32px 0' }
const footer = {
  fontSize: '12px',
  color: '#9CA3AF',
  textAlign: 'center' as const,
  lineHeight: '1.6',
}

// Mask PII (phone numbers, emails, addresses, common name patterns) before persisting to logs.
// Conservative: only masks recognizable patterns; leaves general text intact.

export function maskPII(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input);

  // Email
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[이메일]');

  // Korean / international phone numbers (010-1234-5678, 01012345678, +82 10 ...)
  s = s.replace(/(\+?\d{1,3}[-.\s]?)?(0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}/g, '[전화번호]');

  // Resident registration / card-like long digit sequences (8+ digits)
  s = s.replace(/\b\d{6}[-\s]?\d{7}\b/g, '[주민번호]');
  s = s.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[카드번호]');

  // Korean address keywords (시/도 + 구/군 + 동/로/길) — coarse mask of the trailing detail
  s = s.replace(/([가-힣]{2,}(시|도))\s*([가-힣]{1,}(구|군|시))\s*[가-힣0-9\s]{2,30}(동|로|길|읍|면)\s*\d{0,4}[-\d]*/g, '[주소]');

  // Bare detailed address (동/로/길 + 번지)
  s = s.replace(/[가-힣0-9]{2,}(동|로|길)\s*\d{1,4}(-\d{1,4})?(번지)?/g, '[주소]');

  // Korean nicknames preceded by typical markers
  s = s.replace(/(닉네임|아이디|ID|작성자|고객명|성함|이름)\s*[:：]?\s*[A-Za-z0-9가-힣_*]{2,20}/g, '$1: [이름]');

  return s;
}

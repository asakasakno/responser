// 판매 플랫폼 정의 (그룹화 + 플랫폼별 응대 톤)
// 카테고리별로 묶어 회원가입/설정 화면에서 동일하게 사용합니다.

export interface PlatformItem {
  id: string;
  label: string;
}

export interface PlatformGroup {
  id: string;
  label: string;
  items: PlatformItem[];
}

export const PLATFORM_GROUPS: PlatformGroup[] = [
  {
    id: 'openmarket',
    label: '오픈마켓',
    items: [
      { id: 'coupang', label: '쿠팡' },
      { id: '11st', label: '11번가' },
      { id: 'gmarket', label: 'G마켓' },
      { id: 'auction', label: '옥션' },
      { id: 'interpark', label: 'NOL 인터파크' },
      { id: 'tossshopping', label: '토스쇼핑' },
    ],
  },
  {
    id: 'store',
    label: '스토어 운영',
    items: [
      { id: 'naver', label: '스마트스토어' },
      { id: 'cafe24', label: '카페24' },
      { id: 'self', label: '자사몰' },
    ],
  },
  {
    id: 'fashion',
    label: '패션',
    items: [
      { id: 'musinsa', label: '무신사' },
      { id: 'ably', label: '에이블리' },
      { id: 'zigzag', label: '지그재그' },
    ],
  },
  {
    id: 'living',
    label: '리빙',
    items: [
      { id: 'ohouse', label: '오늘의집' },
    ],
  },
  {
    id: 'delivery',
    label: '배달앱',
    items: [
      { id: 'baemin', label: '배달의민족' },
      { id: 'yogiyo', label: '요기요' },
      { id: 'coupangeats', label: '쿠팡이츠' },
    ],
  },
  {
    id: 'etc',
    label: '기타',
    items: [
      { id: 'other', label: '직접입력' },
    ],
  },
];

// 평탄화된 전체 플랫폼 목록 (라벨 조회용)
export const ALL_PLATFORMS: PlatformItem[] = PLATFORM_GROUPS.flatMap(g => g.items);

export function getPlatformLabel(id: string): string {
  return ALL_PLATFORMS.find(p => p.id === id)?.label ?? id;
}

// 플랫폼별 업종 화이트리스트 (지정 안 된 플랫폼은 모든 업종 허용)
// 배달앱은 식품만, 패션 플랫폼은 패션만, 오늘의집은 리빙 중심 등
export const PLATFORM_BUSINESS_CATEGORIES: Record<string, string[]> = {
  // 배달앱 → 식품
  baemin: ['food'],
  yogiyo: ['food'],
  coupangeats: ['food'],
  // 패션 전문몰
  musinsa: ['fashion', 'beauty'],
  ably: ['fashion', 'beauty', 'living'],
  zigzag: ['fashion', 'beauty'],
  // 리빙 전문몰
  ohouse: ['living', 'pet', 'baby'],
};

export function getAllowedBusinessCategories(platformId?: string | null): string[] | null {
  if (!platformId || platformId === 'auto' || platformId === 'other') return null;
  return PLATFORM_BUSINESS_CATEGORIES[platformId] ?? null;
}

// LivePoll Design Tokens
// 발표 화면(프로젝터) + 모바일 입력을 위한 기업용·미니멀 토큰.
// JS 객체 + CSS 변수 두 형태로 제공합니다.

export const tokens = {
  // 60·30·10 규칙: 60 중립(화이트·그레이) · 30 메인(네이비) · 10 강조(머스터드)
  color: {
    primary:     '#34538C', // 메인 — 차분한 네이비
    primaryDark: '#26406E',
    primarySoft: '#EEF2F8',
    accent:      '#C8843C', // 강조 — 머스터드 (10% 미만만 사용)
    accentSoft:  '#F6EEE3',
    ink:         '#0F172A',
    muted:       '#64748B',
    faint:       '#94A3B8',
    border:      '#E2E8F0',
    surface:     '#F1F5F9',
    bg:          '#F8FAFC',
    white:       '#FFFFFF',
    // 다크 무대(Stage) 방향
    stageBg:     '#0F1A2E',
    stagePanel:  '#1B2740',
    accentStage: '#D9924A', // 다크 배경용 강조
    // 데이터 차트: 무지개색 ❌ → 단일 색상 명도 스케일 (순위 높은순 → 진함). 1위만 accent.
    scale:      ['#2B4576', '#4E6B9C', '#8398BC', '#B3C0D6'],
    scaleStage: ['#7E9BCB', '#5E7CAE', '#46618F', '#3A527A'],
    bubbleScale: ['#2B4576', '#3C5A8C', '#4D6A9B', '#5F7BA9', '#7288B6'],
  },

  // 글자 크기 단계 (px). 발표 화면은 stage* 사용.
  fontSize: {
    caption: 12,
    label:   13,
    body:    17,
    subhead: 22,
    heading: 28,
    display: 40,
    stageTitle:  38, // 프로젝터 질문 제목
    stageLabel:  24, // 프로젝터 보기 라벨
    stageNumber: 30, // 프로젝터 득표 숫자
  },

  fontWeight: { regular: 400, medium: 600, bold: 700, black: 800 },

  // 여백 (4px 기준 배수)
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64 },

  radius: { sm: 8, md: 12, lg: 14, pill: 999 },

  font: "'Pretendard', system-ui, -apple-system, sans-serif",
};

// CSS 변수 문자열 — :root 등에 주입해서 사용하세요.
export const cssVariables = `
:root {
  --lp-primary: #34538C;
  --lp-primary-dark: #26406E;
  --lp-primary-soft: #EEF2F8;
  --lp-accent: #C8843C;
  --lp-accent-soft: #F6EEE3;
  --lp-ink: #0F172A;
  --lp-muted: #64748B;
  --lp-faint: #94A3B8;
  --lp-border: #E2E8F0;
  --lp-surface: #F1F5F9;
  --lp-bg: #F8FAFC;
  --lp-success: #16A34A;
  --lp-stage-bg: #0F1A2E;
  --lp-stage-panel: #1B2740;

  --lp-fs-caption: 12px;
  --lp-fs-label: 13px;
  --lp-fs-body: 17px;
  --lp-fs-subhead: 22px;
  --lp-fs-heading: 28px;
  --lp-fs-display: 40px;

  --lp-space-xs: 4px;
  --lp-space-sm: 8px;
  --lp-space-md: 16px;
  --lp-space-lg: 24px;
  --lp-space-xl: 32px;
  --lp-space-2xl: 48px;

  --lp-radius-sm: 8px;
  --lp-radius-md: 12px;
  --lp-radius-lg: 14px;
}`;

export default tokens;

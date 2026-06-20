# LivePoll — Frontend

라이브폴 디자인 시안(`LivePoll 시안.dc.html`)의 구현체입니다. React + Vite + Recharts로
만들었고, 이 저장소의 Supabase 백엔드(Edge Functions + Realtime)에 연결됩니다.

## 화면

| 경로 | 화면 | 내용 |
|---|---|---|
| `/` | 참여자 (Voter) | PIN 입력 → 객관식/주관식 응답 → 제출 완료 |
| `/admin` | 관리자 대시보드 | 투표 생성 · PIN/QR · 실시간 막대/버블 결과 |
| `/stage?pin=######` | 발표 무대 (Stage) | 프로젝터용 다크 테마, 큰 글자 실시간 막대 |

## 디자인 핸드오프 반영

- `src/tokens.js` — 디자인 토큰(색·타입·여백). 시안 핸드오프 그대로.
- `src/components/BarResults.jsx` — 객관식 가로 막대 (1위만 강조색, 나머지 네이비 명도 스케일).
- `src/components/BubbleResults.jsx` — 주관식 의견 묶음 버블 (크기 ∝ member_count, 호버 시 요약).
- 60·30·10 색 규칙, Pretendard 폰트, 빈 상태 플레이스홀더 포함.

## 실행

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

### 데모 모드 vs 라이브 모드

환경변수가 없으면 **데모 모드**로 동작합니다 — 시안처럼 표본 데이터가 실시간으로
갱신되어 화면을 바로 확인할 수 있습니다.

실제 백엔드에 연결하려면 `web/.env.local`을 만들고 채우세요:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

라이브 모드에서는:
- 투표 생성 → `create-poll` Edge Function
- PIN 조회 → `get-poll`
- 응답 제출 → `submit-response` (객관식/주관식 파이프라인)
- 결과 갱신 → `responses` · `clusters` 테이블 Realtime 구독

## 빌드

```bash
npm run build      # dist/ 생성
npm run preview    # 빌드 결과 미리보기
```

## 메모

- 차트 컴포넌트는 순수 표현(presentational) 컴포넌트이며, 데이터 주입은 화면(screen)이 담당합니다.
- 라이브 모드의 직접 테이블 조회/구독은 `responses`·`clusters`에 RLS가 꺼져 있다는 전제입니다
  (백엔드 초기 마이그레이션 상태와 동일). 운영 환경에서는 RLS 정책 설계가 필요합니다.

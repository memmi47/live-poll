/**
 * Seed / smoke-test script
 *
 * Usage:
 *   deno run --allow-net --allow-env scripts/seed-test.ts
 *
 * Required env vars:
 *   SUPABASE_URL             e.g. https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY  (or SUPABASE_ANON_KEY for public-facing functions)
 *   OPENROUTER_API_KEY       for the labelling step
 *
 * What it does:
 *   1. Creates a test poll via the create-poll Edge Function
 *   2. Submits 20 Korean open-ended responses (four thematic groups)
 *      via the submit-response Edge Function so the full pipeline runs
 *   3. Waits for background labelling calls to complete
 *   4. Fetches the resulting clusters via the get-poll Edge Function
 *   5. Prints a summary and exits non-zero if something looks wrong
 */

const BASE_URL = Deno.env.get('SUPABASE_URL');
const API_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_ANON_KEY');

if (!BASE_URL || !API_KEY) {
  console.error(
    '❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)',
  );
  Deno.exit(1);
}

const FUNCTIONS_BASE = `${BASE_URL}/functions/v1`;

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

// ── Test responses (20 total, four thematic groups) ──────────────────────────
// Groups are chosen so that within-group cosine similarity > 0.78 and
// between-group similarity < 0.78 after gte-small encoding.

const TEST_RESPONSES: string[] = [
  // 🚌 교통 (Transportation) – 5 responses
  '버스 배차 간격이 너무 길어서 출퇴근이 불편합니다',
  '지하철역 근처에 자전거 보관소가 더 많이 필요합니다',
  '대중교통 요금이 인상되면 시민들의 부담이 너무 커집니다',
  '심야 버스 노선을 확대해 주시면 야근 후 귀가가 훨씬 편할 것 같아요',
  '교통 앱이 실시간 혼잡도 정보를 제공해 준다면 더 유용할 것 같습니다',

  // 🌿 환경 (Environment) – 5 responses
  '일회용 플라스틱 컵 사용을 전면 금지해야 합니다',
  '태양광 패널 설치 보조금을 늘려서 친환경 에너지를 확산시켜야 합니다',
  '분리수거 교육이 부족해서 재활용률이 낮은 것 같습니다',
  '도심 내 녹지 공간을 늘리면 미세먼지 저감에 도움이 됩니다',
  '전기차 충전소 인프라를 지금보다 훨씬 빠르게 구축해야 합니다',

  // 🍜 음식 (Food & Dining) – 5 responses
  '동네 전통 시장에 위생 시설을 개선하면 더 많은 사람이 방문할 것 같아요',
  '학교 급식 메뉴가 너무 단조로워서 아이들이 잘 먹지 않습니다',
  '로컬 농산물을 식당에서 더 많이 사용할 수 있도록 지원해 주세요',
  '채식 메뉴 선택지가 적어서 채식주의자들이 외식하기 어렵습니다',
  '음식 배달 포장재를 친환경 소재로 교체하는 캠페인이 필요합니다',

  // 🎨 문화·여가 (Culture & Leisure) – 5 responses
  '공공 도서관 개관 시간을 주말에도 저녁 9시까지 연장해 주세요',
  '지역 축제가 너무 획일적이라 주민들의 참여 의지가 낮습니다',
  '청소년 문화 공간이 부족해서 방과 후 갈 곳이 없는 아이들이 많아요',
  '야외 공연장을 늘려서 문화 접근성을 높여야 한다고 생각합니다',
  '동네 체육 시설 이용 요금이 너무 비싸서 운동하기 부담스럽습니다',
];

// ── helpers ──────────────────────────────────────────────────────────────────

async function callFunction(
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: 'POST',
    headers: AUTH_HEADERS,
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log('🌱  Live Poll seed / smoke-test');
console.log(`📡  Supabase: ${BASE_URL}`);
console.log('');

// 1. Create poll
console.log('1️⃣   Creating test poll …');
const createResult = (await callFunction('create-poll', {
  title: '우리 동네를 더 살기 좋게 만들려면?',
  question_type: 'open',
})) as { poll: { id: string; pin: string } };

const { id: poll_id, pin } = createResult.poll;
console.log(`    ✅  Created poll  id=${poll_id}  pin=${pin}`);
console.log('');

// 2. Submit all 20 responses (sequential to avoid race conditions on cluster table)
console.log('2️⃣   Submitting 20 open-ended responses …');
let submitted = 0;
for (const text of TEST_RESPONSES) {
  await callFunction('submit-response', { poll_id, kind: 'open', text });
  submitted++;
  process.stdout?.write?.(`\r    ${submitted} / ${TEST_RESPONSES.length}`);
  Deno.stdout.writeSync(
    new TextEncoder().encode(`\r    ${submitted} / ${TEST_RESPONSES.length}`),
  );
}
console.log('\n    ✅  All responses submitted');
console.log('');

// 3. Give the fire-and-forget label calls a moment to finish
const LABEL_WAIT_MS = 15_000;
console.log(`3️⃣   Waiting ${LABEL_WAIT_MS / 1000}s for background labelling …`);
await sleep(LABEL_WAIT_MS);
console.log('    ✅  Wait complete');
console.log('');

// 4. Fetch clusters via get-poll
console.log('4️⃣   Fetching results …');
const getRes = await fetch(
  `${FUNCTIONS_BASE}/get-poll?pin=${pin}`,
  { headers: AUTH_HEADERS },
);
const getResult = (await getRes.json()) as {
  poll: Record<string, unknown>;
  clusters: Array<{
    id: string;
    label: string | null;
    summary: string | null;
    member_count: number;
    is_dirty: boolean;
  }>;
};

const clusters = getResult.clusters ?? [];

// 5. Print summary
console.log(`\n📊  Results for poll "${pin}"`);
console.log(`    Total responses : ${TEST_RESPONSES.length}`);
console.log(`    Clusters formed : ${clusters.length}`);
console.log('');
console.log('    Cluster breakdown:');
for (const cl of clusters) {
  const label = cl.label ?? '(not yet labelled)';
  const dirty = cl.is_dirty ? ' ⏳ dirty' : ' ✅ labelled';
  console.log(`    • [${cl.member_count} responses] ${label}${dirty}`);
  if (cl.summary) console.log(`      "${cl.summary}"`);
}

// 6. Assertions
const errors: string[] = [];

if (clusters.length < 2) {
  errors.push(`Expected ≥ 2 clusters, got ${clusters.length}`);
}
if (clusters.length > 10) {
  errors.push(`Expected ≤ 10 clusters, got ${clusters.length} (threshold may be too high)`);
}
const labelledCount = clusters.filter((c) => c.label !== null).length;
if (labelledCount === 0) {
  errors.push('No clusters received labels – check OPENROUTER_API_KEY and label-cluster logs');
}
const totalAssigned = clusters.reduce((s, c) => s + c.member_count, 0);
if (totalAssigned !== TEST_RESPONSES.length) {
  errors.push(
    `member_count total ${totalAssigned} ≠ submitted responses ${TEST_RESPONSES.length}`,
  );
}

if (errors.length > 0) {
  console.log('\n❌  Test failures:');
  for (const e of errors) console.log(`    - ${e}`);
  Deno.exit(1);
} else {
  console.log('\n✅  All assertions passed!');
}

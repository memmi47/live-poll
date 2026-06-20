import { assertEquals } from './_assert.ts';
import { safeParseLabel } from '../_shared/parse.ts';

Deno.test('safeParseLabel: clean JSON', () => {
  const out = safeParseLabel('{"label": "교통", "summary": "대중교통 개선 요구"}');
  assertEquals(out, { label: '교통', summary: '대중교통 개선 요구' });
});

Deno.test('safeParseLabel: fenced ```json block', () => {
  const raw = '```json\n{"label": "환경", "summary": "친환경 정책 확대"}\n```';
  assertEquals(safeParseLabel(raw), { label: '환경', summary: '친환경 정책 확대' });
});

Deno.test('safeParseLabel: bare ``` fence', () => {
  const raw = '```\n{"label": "음식", "summary": "급식 다양화"}\n```';
  assertEquals(safeParseLabel(raw), { label: '음식', summary: '급식 다양화' });
});

Deno.test('safeParseLabel: surrounding whitespace', () => {
  const raw = '   \n {"label": "문화", "summary": "여가 공간 확충"}  \n ';
  assertEquals(safeParseLabel(raw), { label: '문화', summary: '여가 공간 확충' });
});

Deno.test('safeParseLabel: not JSON → null', () => {
  assertEquals(safeParseLabel('I cannot answer that.'), null);
});

Deno.test('safeParseLabel: missing summary → null', () => {
  assertEquals(safeParseLabel('{"label": "교통"}'), null);
});

Deno.test('safeParseLabel: wrong field types → null', () => {
  assertEquals(safeParseLabel('{"label": 1, "summary": "x"}'), null);
});

Deno.test('safeParseLabel: empty string → null', () => {
  assertEquals(safeParseLabel(''), null);
});

Deno.test('safeParseLabel: extra fields are tolerated', () => {
  const raw = '{"label": "교통", "summary": "요약", "confidence": 0.9}';
  assertEquals(safeParseLabel(raw), { label: '교통', summary: '요약' });
});

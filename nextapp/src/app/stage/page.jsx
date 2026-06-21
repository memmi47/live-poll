'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { fetchChoiceResponses, getPoll, isLive, subscribeResponses } from '../../lib/api';

const navyScaleStage = ['#7E9BCB', '#5E7CAE', '#46618F', '#3A527A'];
const accentStage = '#D9924A';

const DEMO = {
  pin: '482901',
  title: '오늘 점심 메뉴는 어디로 할까요?',
  options: ['한식', '양식', '중식', '일식'],
  seed: [34, 21, 13, 6],
};

function StageInner() {
  const params = useSearchParams();
  const pin = params.get('pin');

  const [poll, setPoll] = useState(isLive ? null : DEMO);
  const [counts, setCounts] = useState({});
  const [mounted, setMounted] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!isLive) return;
    if (!pin) return;
    getPoll(pin)
      .then(({ poll }) => setPoll({ ...poll, options: poll.options || [] }))
      .catch(() => {});
  }, [pin]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);

    if (!isLive) {
      setCounts(Object.fromEntries(DEMO.options.map((o, i) => [o, DEMO.seed[i]])));
      timer.current = setInterval(() => {
        setCounts((c) => {
          const keys = Object.keys(c);
          if (!keys.length) return c;
          const k = keys[Math.floor(Math.random() * keys.length)];
          return { ...c, [k]: c[k] + 1 + Math.floor(Math.random() * 2) };
        });
      }, 2600);
      return () => { clearTimeout(t); clearInterval(timer.current); };
    }

    if (!poll?.id) return () => clearTimeout(t);
    fetchChoiceResponses(poll.id)
      .then((rows) => {
        const tally = {};
        for (const r of rows) {
          if (r.choice_value) tally[r.choice_value] = (tally[r.choice_value] || 0) + 1;
        }
        setCounts(tally);
      })
      .catch(() => {});
    const unsub = subscribeResponses(poll.id, (row) => {
      if (row.poll_id !== poll.id) return;
      if (row.kind === 'choice' && row.choice_value) {
        setCounts((c) => ({ ...c, [row.choice_value]: (c[row.choice_value] || 0) + 1 }));
      }
    });
    return () => { clearTimeout(t); unsub(); };
  }, [poll?.id]);

  const options = poll && Array.isArray(poll.options) && poll.options.length ? poll.options : Object.keys(counts);
  const countList = options.map((o) => counts[o] || 0);
  const totalVotes = countList.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...countList, 1) * 1.12;

  const order = countList.map((c, i) => i).sort((a, b) => countList[b] - countList[a]);
  const rankOf = {};
  order.forEach((idx, r) => { rankOf[idx] = r; });

  const participants = isLive ? totalVotes : 74;

  return (
    <div style={{ minHeight: '100vh', background: '#0b1322', padding: 32 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Link href="/admin" style={{ color: '#64748b', fontSize: 14, fontWeight: 600 }}>← 관리자 대시보드</Link>
          {!isLive && <span style={{ color: '#64748b', fontSize: 13 }}>데모 모드</span>}
        </div>

        <div style={{
          background: 'var(--lp-stage-bg)', borderRadius: 14,
          boxShadow: '0 8px 40px rgba(15,23,42,.3)', overflow: 'hidden', padding: '40px 48px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#fff' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(200,132,60,.18)', color: accentStage,
                padding: '8px 16px', borderRadius: 999, fontSize: 15, fontWeight: 700,
              }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: accentStage, animation: 'lp-pulse 1.1s ease-in-out infinite' }} />
                LIVE
              </div>
              <span style={{ fontSize: 16, color: 'var(--lp-faint)' }}>{participants}명 참여</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ textAlign: 'right', color: '#fff' }}>
                <div style={{ fontSize: 13, color: 'var(--lp-muted)', fontWeight: 600 }}>참여 PIN</div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '.1em', color: '#fff' }}>
                  {(poll?.pin || '------').replace(/(\d{3})(\d{3})/, '$1 $2')}
                </div>
              </div>
              <div style={{
                width: 72, height: 72, borderRadius: 12, background: '#1E293B',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#475569', fontSize: 11,
              }}>QR</div>
            </div>
          </div>

          <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 36, lineHeight: 1.2 }}>
            {poll?.title || '투표를 기다리는 중…'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {options.map((opt, i) => {
              const r = rankOf[i];
              const color = r === 0 ? accentStage : navyScaleStage[r - 1] || navyScaleStage[navyScaleStage.length - 1];
              const pct = Math.round((countList[i] / max) * 100);
              const pctLabel = Math.round((countList[i] / totalVotes) * 100) + '%';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ flex: 'none', width: 200, fontSize: 24, fontWeight: 700, color: '#E2E8F0', textAlign: 'right' }}>{opt}</div>
                  <div style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--lp-stage-panel)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 12,
                      transition: 'width 1s cubic-bezier(.22,1,.36,1)',
                      background: color, width: mounted ? pct + '%' : '0%',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16,
                    }}>
                      <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{pctLabel}</span>
                    </div>
                  </div>
                  <div style={{ flex: 'none', width: 90, fontSize: 30, fontWeight: 800, color: '#fff' }}>{countList[i]}</div>
                </div>
              );
            })}
            {options.length === 0 && (
              <div style={{ color: '#64748b', fontSize: 20, padding: '40px 0' }}>아직 응답이 없습니다. PIN을 공유해 참여를 받아보세요.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StagePage() {
  return (
    <Suspense>
      <StageInner />
    </Suspense>
  );
}

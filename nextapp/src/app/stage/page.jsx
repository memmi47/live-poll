'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  fetchChoiceResponses, fetchClusters, getPoll, isLive,
  subscribeResponses, subscribeClusters, supabase,
} from '../../lib/api';
import BubbleResults from '../../components/BubbleResults';

const navyScaleStage = ['#7E9BCB', '#5E7CAE', '#46618F', '#3A527A'];
const accentStage = '#D9924A';

const DEMO = {
  pin: '482901',
  title: '오늘 점심 메뉴는 어디로 할까요?',
  question_type: 'choice',
  options: ['한식', '양식', '중식', '일식'],
  questions: [
    { title: '오늘 점심 메뉴는 어디로 할까요?', question_type: 'choice', options: ['한식', '양식', '중식', '일식'] },
    { title: '선호하는 분위기는 어떤가요?', question_type: 'open', options: [] },
  ],
  seed: [34, 21, 13, 6],
};

function ArrowBtn({ dir, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 44, height: 44, borderRadius: 10, border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        background: disabled ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.14)',
        color: disabled ? '#475569' : '#E2E8F0',
        fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {dir === 'prev' ? '‹' : '›'}
    </button>
  );
}

function StageInner() {
  const params = useSearchParams();
  const pin = params.get('pin');
  const qIdx = parseInt(params.get('q') || '0', 10);

  const [poll, setPoll] = useState(isLive ? null : DEMO);
  const [counts, setCounts] = useState({});
  const [clusters, setClusters] = useState([]);
  const [participants, setParticipants] = useState(isLive ? 0 : 74);
  const [stageQIdx, setStageQIdx] = useState(qIdx);
  const [viewMode, setViewMode] = useState('choice');
  const [mounted, setMounted] = useState(false);
  const demoTimer = useRef(null);

  // Normalize to questions array
  const questions =
    poll && Array.isArray(poll.questions) && poll.questions.length > 0
      ? poll.questions
      : poll
      ? [{ title: poll.title, question_type: poll.question_type || 'choice', options: poll.options || [] }]
      : [];

  const currentQ = questions[stageQIdx] || {};
  const showChoice = currentQ.question_type === 'choice' || currentQ.question_type === 'both';
  const showOpen = currentQ.question_type === 'open' || currentQ.question_type === 'both';

  // Sync stageQIdx when query param 'q' changes
  useEffect(() => {
    setStageQIdx(qIdx);
  }, [qIdx]);

  // For "both" type, user can toggle between choice/open.
  // For single-type questions, always show the correct view regardless of viewMode state.
  // This avoids a race condition where viewMode is set before poll loads.
  const effectiveViewMode = showChoice && showOpen ? viewMode : showChoice ? 'choice' : 'open';

  // Reset toggle when switching questions or when poll first loads
  useEffect(() => {
    setViewMode('choice');
  }, [stageQIdx, poll?.id]);

  // Load poll from PIN
  useEffect(() => {
    if (!isLive || !pin) return;
    getPoll(pin)
      .then(({ poll: p }) => setPoll({ ...p, options: p.options || [] }))
      .catch(() => {});
  }, [pin]);

  // Mount animation flag
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  // Data fetch + realtime, re-runs when poll or question index changes
  useEffect(() => {
    clearInterval(demoTimer.current);
    setCounts({});
    setClusters([]);

    if (!isLive) {
      if (stageQIdx === 0) {
        setCounts(Object.fromEntries(DEMO.options.map((o, i) => [o, DEMO.seed[i]])));
        demoTimer.current = setInterval(() => {
          setCounts((c) => {
            const keys = Object.keys(c);
            if (!keys.length) return c;
            const k = keys[Math.floor(Math.random() * keys.length)];
            return { ...c, [k]: c[k] + 1 + Math.floor(Math.random() * 2) };
          });
        }, 2600);
      }
      return () => clearInterval(demoTimer.current);
    }

    if (!poll?.id) return;

    function loadChoice() {
      fetchChoiceResponses(poll.id, stageQIdx)
        .then((rows) => {
          const tally = {};
          for (const r of rows) {
            if (r.choice_value) tally[r.choice_value] = (tally[r.choice_value] || 0) + 1;
          }
          setCounts(tally);
        })
        .catch(() => {});
    }

    function loadClusters() {
      fetchClusters(poll.id, stageQIdx).then(setClusters).catch(() => {});
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    function loadParticipants() {
      supabase
        .from('responses')
        .select('voter_id')
        .eq('poll_id', poll.id)
        .not('voter_id', 'is', null)
        .then(({ data }) => {
          if (data) setParticipants(new Set(data.map((r) => r.voter_id)).size);
        });
    }

    loadChoice();
    loadClusters();
    loadParticipants();

    // 5s polling fallback in case realtime misses events
    const pollInterval = setInterval(() => {
      loadChoice();
      loadClusters();
      loadParticipants();
    }, 5000);

    const unsubResponses = subscribeResponses(poll.id, (row) => {
      if (row.poll_id !== poll.id) return;
      if ((row.question_idx ?? 0) !== stageQIdx) return;
      if (row.kind === 'choice' && row.choice_value) {
        setCounts((c) => ({ ...c, [row.choice_value]: (c[row.choice_value] || 0) + 1 }));
      }
    });

    const unsubClusters = subscribeClusters(poll.id, () => loadClusters());

    return () => {
      clearInterval(pollInterval);
      unsubResponses();
      unsubClusters();
    };
  }, [poll?.id, stageQIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const options =
    Array.isArray(currentQ.options) && currentQ.options.length > 0
      ? currentQ.options
      : Object.keys(counts);
  const countList = options.map((o) => counts[o] || 0);
  const totalVotes = countList.reduce((a, b) => a + b, 0);
  const max = Math.max(...countList, 1) * 1.12;

  const order = countList.map((_, i) => i).sort((a, b) => countList[b] - countList[a]);
  const rankOf = {};
  order.forEach((idx, r) => { rankOf[idx] = r; });

  const backHref = poll?.pin ? `/admin?pin=${poll.pin}` : '/admin';

  return (
    <div style={{ minHeight: '100vh', background: '#0b1322', padding: 32 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Link href={backHref} style={{ color: '#64748b', fontSize: 14, fontWeight: 600 }}>
            ← 관리자 대시보드
          </Link>
          {!isLive && <span style={{ color: '#64748b', fontSize: 13 }}>데모 모드</span>}
        </div>

        <div style={{
          background: 'var(--lp-stage-bg)', borderRadius: 14,
          boxShadow: '0 8px 40px rgba(15,23,42,.3)', overflow: 'hidden', padding: '40px 48px',
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(200,132,60,.18)', color: accentStage,
                padding: '8px 16px', borderRadius: 999, fontSize: 15, fontWeight: 700,
              }}>
                <span style={{
                  width: 9, height: 9, borderRadius: '50%',
                  background: accentStage, animation: 'lp-pulse 1.1s ease-in-out infinite',
                }} />
                LIVE
              </div>
              <span style={{ fontSize: 16, color: 'var(--lp-faint)' }}>{participants}명 참여</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div style={{ textAlign: 'right' }}>
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

          {/* Question navigation arrows */}
          {questions.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <ArrowBtn dir="prev" onClick={() => setStageQIdx((i) => i - 1)} disabled={stageQIdx === 0} />
              <span style={{ color: '#94A3B8', fontSize: 15, fontWeight: 700, minWidth: 56, textAlign: 'center' }}>
                {stageQIdx + 1} / {questions.length}
              </span>
              <ArrowBtn dir="next" onClick={() => setStageQIdx((i) => i + 1)} disabled={stageQIdx === questions.length - 1} />
            </div>
          )}

          {/* Question title */}
          <div style={{
            fontSize: 38, fontWeight: 800, color: '#fff',
            letterSpacing: '-.02em', marginBottom: 28, lineHeight: 1.2,
          }}>
            {currentQ.title || '투표를 기다리는 중…'}
          </div>

          {/* View mode toggle for "both" type questions */}
          {showChoice && showOpen && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
              {[
                { mode: 'choice', label: '객관식 결과' },
                { mode: 'open', label: '주관식 결과' },
              ].map(({ mode, label }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  style={{
                    padding: '8px 20px', borderRadius: 999, fontSize: 14, fontWeight: 700,
                    border: 'none', cursor: 'pointer',
                    background: effectiveViewMode === mode ? accentStage : 'rgba(255,255,255,.1)',
                    color: effectiveViewMode === mode ? '#fff' : '#94A3B8',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Choice bar results */}
          {showChoice && effectiveViewMode === 'choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {options.map((opt, i) => {
                const r = rankOf[i];
                const color = r === 0 ? accentStage : navyScaleStage[r - 1] || navyScaleStage[navyScaleStage.length - 1];
                const pct = Math.round((countList[i] / max) * 100);
                const pctLabel = totalVotes > 0
                  ? Math.round((countList[i] / totalVotes) * 100) + '%'
                  : '0%';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <div style={{ flex: 'none', width: 200, fontSize: 24, fontWeight: 700, color: '#E2E8F0', textAlign: 'right' }}>
                      {opt}
                    </div>
                    <div style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--lp-stage-panel)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 12,
                        transition: 'width 1s cubic-bezier(.22,1,.36,1)',
                        background: color, width: mounted ? pct + '%' : '0%',
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16,
                      }}>
                        {pct > 12 && (
                          <span style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{pctLabel}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 'none', width: 90, fontSize: 30, fontWeight: 800, color: '#fff' }}>
                      {countList[i]}
                    </div>
                  </div>
                );
              })}
              {options.length === 0 && (
                <div style={{ color: '#64748b', fontSize: 20, padding: '40px 0' }}>
                  아직 응답이 없습니다. PIN을 공유해 참여를 받아보세요.
                </div>
              )}
            </div>
          )}

          {/* Bubble results for open-text */}
          {showOpen && effectiveViewMode === 'open' && (
            <BubbleResults data={clusters} stage={true} />
          )}
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

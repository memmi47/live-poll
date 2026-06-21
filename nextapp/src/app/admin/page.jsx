'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import BarResults from '../../components/BarResults';
import BubbleResults from '../../components/BubbleResults';
import {
  createPoll,
  fetchChoiceResponses,
  fetchClusters,
  getPoll,
  isLive,
  subscribeClusters,
  subscribeResponses,
  supabase,
} from '../../lib/api';

function AdminInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pinFromUrl = searchParams.get('pin');

  const [poll, setPoll] = useState(null);
  const [history, setHistory] = useState([]);
  const [participants, setParticipants] = useState(0);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem('lp_poll_history') || '[]'));
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLive || !pinFromUrl || poll) return;
    getPoll(pinFromUrl)
      .then(({ poll: p }) => setPoll(p))
      .catch(() => {});
  }, [pinFromUrl]);

  useEffect(() => {
    if (!isLive || !poll?.id) return;
    const fetchParticipants = () => {
      supabase
        .from('responses')
        .select('voter_id')
        .eq('poll_id', poll.id)
        .not('voter_id', 'is', null)
        .then(({ data }) => {
          if (data) setParticipants(new Set(data.map((r) => r.voter_id)).size);
        });
    };
    fetchParticipants();
    const timer = setInterval(fetchParticipants, 5000);
    return () => clearInterval(timer);
  }, [poll?.id]);

  function onPollCreated(newPoll) {
    setPoll({ ...newPoll });
    setParticipants(0);
    router.push(`/admin?pin=${newPoll.pin}`, { scroll: false });
    const newEntry = { pin: newPoll.pin, title: newPoll.title, created_at: new Date().toISOString() };
    const updated = [newEntry, ...history.filter((h) => h.pin !== newPoll.pin)].slice(0, 5);
    localStorage.setItem('lp_poll_history', JSON.stringify(updated));
    setHistory(updated);
  }

  async function selectHistoryPoll(pin) {
    try {
      const { poll: p } = await getPoll(pin);
      setPoll(p);
      router.push(`/admin?pin=${pin}`, { scroll: false });
    } catch {}
  }

  return (
    <>
      {!isLive && (
        <div className="lp-demo-banner">
          데모 모드 — Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)를 설정하면 실제 백엔드에 연결됩니다.
        </div>
      )}
      <div style={{ minHeight: '100vh', background: '#e7e5df', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <TopHeading />
          <RecentPollsBar history={history} onSelect={selectHistoryPoll} />
          <div style={{
            background: '#fff', borderRadius: 14,
            boxShadow: '0 8px 30px rgba(15,23,42,.10)',
            overflow: 'hidden', border: '1px solid var(--lp-border)',
          }}>
            <DashboardBar poll={poll} participants={participants} />
            <div style={{ display: 'flex', gap: 28, padding: '24px 20px', flexWrap: 'wrap' }}>
              <CreatePanel poll={poll} onPollCreated={onPollCreated} />
              <ResultsPanel poll={poll} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminInner />
    </Suspense>
  );
}

function TopHeading() {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 13, letterSpacing: '.14em', fontWeight: 700,
        color: 'var(--lp-primary)', textTransform: 'uppercase', marginBottom: 6,
      }}>
        LivePoll · 관리자
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>대시보드</div>
        <Link href="/join" style={{ fontSize: 14, color: 'var(--lp-muted)', fontWeight: 600 }}>
          참여자 화면 →
        </Link>
      </div>
    </div>
  );
}

function RecentPollsBar({ history, onSelect }) {
  if (!history.length) return null;
  return (
    <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-faint)', flexShrink: 0 }}>이전 투표:</span>
      {history.map((h) => (
        <button
          key={h.pin}
          onClick={() => onSelect(h.pin)}
          style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'rgba(255,255,255,.9)', border: '1px solid var(--lp-border)',
            color: 'var(--lp-ink)', cursor: 'pointer',
          }}
        >
          {h.title || h.pin}
        </button>
      ))}
    </div>
  );
}

function DashboardBar({ poll, participants }) {
  const count = isLive ? participants : 74;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 20px', borderBottom: '1px solid var(--lp-surface)', flexWrap: 'wrap', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: 'var(--lp-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 16,
        }}>L</div>
        <span style={{ fontSize: 18, fontWeight: 800 }}>LivePoll 관리자</span>
      </div>
      <span className="lp-live">
        <span className="lp-live__dot" />
        LIVE · {count}명 참여 중
      </span>
    </div>
  );
}

// ── Arrow button style ────────────────────────────────────────────────────────
function ArrowBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, padding: 0, borderRadius: 6,
        border: '1px solid var(--lp-border)', background: 'var(--lp-surface)',
        color: disabled ? 'var(--lp-border)' : 'var(--lp-ink)',
        fontSize: 18, fontWeight: 700, lineHeight: 1, cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

// ── CreatePanel ───────────────────────────────────────────────────────────────
function CreatePanel({ poll, onPollCreated }) {
  const [questions, setQuestions] = useState([
    { title: '', question_type: 'choice', options: ['', ''] },
  ]);
  const [editQIdx, setEditQIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentQ = questions[editQIdx];
  const showOptions = currentQ.question_type === 'choice' || currentQ.question_type === 'both';

  function updateQ(field, val) {
    setQuestions((qs) => qs.map((q, i) => (i === editQIdx ? { ...q, [field]: val } : q)));
  }
  function setOpt(i, v) {
    setQuestions((qs) =>
      qs.map((q, qi) =>
        qi === editQIdx ? { ...q, options: q.options.map((o, oi) => (oi === i ? v : o)) } : q,
      ),
    );
  }
  function addOpt() {
    setQuestions((qs) =>
      qs.map((q, i) => (i === editQIdx ? { ...q, options: [...q.options, ''] } : q)),
    );
  }
  function removeOpt(i) {
    setQuestions((qs) =>
      qs.map((q, qi) =>
        qi === editQIdx ? { ...q, options: q.options.filter((_, oi) => oi !== i) } : q,
      ),
    );
  }
  function addQuestion() {
    const newQs = [...questions, { title: '', question_type: 'choice', options: ['', ''] }];
    setQuestions(newQs);
    setEditQIdx(newQs.length - 1);
  }
  function removeQuestion() {
    if (questions.length <= 1) return;
    const newQs = questions.filter((_, i) => i !== editQIdx);
    setQuestions(newQs);
    setEditQIdx((idx) => Math.min(idx, newQs.length - 1));
  }

  async function create() {
    setBusy(true);
    setError('');
    const normalizedQs = questions.map((q) => ({
      title: q.title.trim(),
      question_type: q.question_type,
      options:
        q.question_type === 'choice' || q.question_type === 'both'
          ? q.options.map((o) => o.trim()).filter(Boolean)
          : [],
    }));
    try {
      if (isLive) {
        const { poll: newPoll } = await createPoll({ questions: normalizedQs });
        onPollCreated(newPoll);
      } else {
        await new Promise((r) => setTimeout(r, 350));
        onPollCreated({
          id: 'demo',
          pin: '482901',
          title: normalizedQs[0].title || '데모 투표',
          question_type: normalizedQs[0].question_type,
          options: normalizedQs[0].options,
          questions: normalizedQs,
        });
      }
    } catch (e) {
      setError(e.message || '생성에 실패했어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 'none', width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ border: '1px solid var(--lp-border)', borderRadius: 12, padding: 20 }}>
        {/* Header row: label + question navigator */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-faint)', letterSpacing: '.06em' }}>
            투표 만들기
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {questions.length > 1 && (
              <>
                <ArrowBtn disabled={editQIdx === 0} onClick={() => setEditQIdx((i) => i - 1)}>‹</ArrowBtn>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-faint)', minWidth: 40, textAlign: 'center' }}>
                  {editQIdx + 1} / {questions.length}
                </span>
                <ArrowBtn disabled={editQIdx === questions.length - 1} onClick={() => setEditQIdx((i) => i + 1)}>›</ArrowBtn>
              </>
            )}
          </div>
        </div>

        <FieldLabel>제목</FieldLabel>
        <input
          value={currentQ.title}
          onChange={(e) => updateQ('title', e.target.value)}
          placeholder="예) 다음 팀 회식 날짜는 언제가 좋을까요?"
          style={inputStyle(false)}
        />

        <FieldLabel style={{ marginTop: 16 }}>유형</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['choice', '객관식'], ['open', '주관식'], ['both', '둘 다']].map(([val, label]) => (
            <button key={val} onClick={() => updateQ('question_type', val)} style={{
              flex: 1,
              background: currentQ.question_type === val ? 'var(--lp-primary)' : 'var(--lp-surface)',
              color: currentQ.question_type === val ? '#fff' : 'var(--lp-muted)',
              textAlign: 'center', padding: 10, borderRadius: 9, fontSize: 13, fontWeight: 700,
            }}>{label}</button>
          ))}
        </div>

        {showOptions && (
          <>
            <FieldLabel>보기</FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {currentQ.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={opt}
                    onChange={(e) => setOpt(i, e.target.value)}
                    placeholder={`보기 ${i + 1}`}
                    style={inputStyle(false)}
                  />
                  {currentQ.options.length > 1 && (
                    <button
                      onClick={() => removeOpt(i)}
                      style={{ background: 'transparent', color: 'var(--lp-faint)', fontSize: 18, padding: '0 4px' }}
                      aria-label="보기 삭제"
                    >×</button>
                  )}
                </div>
              ))}
              <button onClick={addOpt} style={{
                border: '1px dashed #cbd5e1', borderRadius: 9, padding: '10px 12px',
                fontSize: 14, color: 'var(--lp-faint)', background: 'transparent', textAlign: 'left',
              }}>+ 보기 추가</button>
            </div>
          </>
        )}

        {/* Question management buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: error ? 12 : 16 }}>
          <button onClick={addQuestion} style={{
            flex: 1, border: '1px dashed #93c5fd', borderRadius: 9, padding: '9px 12px',
            fontSize: 13, color: 'var(--lp-primary)', fontWeight: 700, background: 'transparent',
          }}>+ 질문 추가</button>
          {questions.length > 1 && (
            <button onClick={removeQuestion} style={{
              border: '1px dashed #fca5a5', borderRadius: 9, padding: '9px 12px',
              fontSize: 13, color: '#dc2626', fontWeight: 700, background: 'transparent',
            }}>이 질문 삭제</button>
          )}
        </div>

        {error && <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</div>}

        <button className="lp-btn lp-btn--ink" style={{ fontSize: 15, padding: 13 }} onClick={create} disabled={busy}>
          {busy ? '생성 중…' : poll ? '새 투표로 교체' : '투표 생성'}
        </button>
      </div>

      <JoinPanel poll={poll} />
    </div>
  );
}

function JoinPanel({ poll }) {
  const pin = poll?.pin ?? '— — —';
  const formatted = pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;
  return (
    <div style={{ border: '1px solid var(--lp-border)', borderRadius: 12, padding: 20, background: 'var(--lp-bg)' }}>
      <SectionLabel>참여 안내</SectionLabel>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{
          flex: 'none', width: 96, height: 96, borderRadius: 12, background: '#fff',
          border: '1px solid var(--lp-border)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#cbd5e1', fontSize: 11, textAlign: 'center', lineHeight: 1.4,
        }}>QR<br />자리</div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--lp-muted)', fontWeight: 600, marginBottom: 4 }}>PIN 코드</div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '.12em', color: 'var(--lp-primary)' }}>{formatted}</div>
          <div style={{ fontSize: 12, color: 'var(--lp-faint)', marginTop: 4 }}>livepoll.app 에서 입력</div>
        </div>
      </div>
    </div>
  );
}

// ── ResultsPanel ──────────────────────────────────────────────────────────────
function ResultsPanel({ poll }) {
  const [viewQIdx, setViewQIdx] = useState(0);

  // Normalize to questions array (same logic as join page)
  const questions =
    poll?.questions?.length > 0
      ? poll.questions
      : poll
      ? [{ title: poll.title, question_type: poll.question_type, options: poll.options }]
      : null;

  const totalQs = questions?.length ?? 0;
  const currentQ = questions?.[viewQIdx] ?? null;

  // Reset view index when poll changes
  useEffect(() => { setViewQIdx(0); }, [poll?.id]);

  const { barData, bubbleData, total } = usePollResults(poll, viewQIdx);

  const showBars = !currentQ || currentQ.question_type === 'choice' || currentQ.question_type === 'both';
  const showBubbles = !currentQ || currentQ.question_type === 'open' || currentQ.question_type === 'both';

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Multi-question navigation */}
      {totalQs > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <ArrowBtn disabled={viewQIdx === 0} onClick={() => setViewQIdx((i) => i - 1)}>‹</ArrowBtn>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-faint)' }}>
            질문 {viewQIdx + 1} / {totalQs}
          </span>
          <ArrowBtn disabled={viewQIdx === totalQs - 1} onClick={() => setViewQIdx((i) => i + 1)}>›</ArrowBtn>
          {currentQ?.title && (
            <span style={{
              fontSize: 13, fontWeight: 600, color: 'var(--lp-ink)',
              marginLeft: 4, flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentQ.title}
            </span>
          )}
        </div>
      )}

      {showBars && (
        <Card>
          <CardHead title="객관식 결과 · 막대그래프" meta={`총 ${total.votes}표`} />
          <BarResults data={barData} />
        </Card>
      )}
      {showBubbles && (
        <Card>
          <CardHead title="주관식 결과 · 버블" meta={`의견 묶음 · ${total.resp}명`} />
          <div style={{ fontSize: 12, color: 'var(--lp-faint)', marginBottom: 6 }}>버블에 마우스를 올리면 요약이 보입니다</div>
          <BubbleResults data={bubbleData} />
        </Card>
      )}
      {poll && (
        <Link href={`/stage?pin=${poll.pin}`} className="lp-btn lp-btn--ghost" style={{ display: 'block', textDecoration: 'none', fontSize: 15, padding: 14 }}>
          발표 화면(무대 모드) 열기
        </Link>
      )}
    </div>
  );
}

// ── usePollResults ────────────────────────────────────────────────────────────
function usePollResults(poll, questionIdx = 0) {
  const [counts, setCounts] = useState({});
  const [clusters, setClusters] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    setCounts({});
    setClusters([]);
    if (timer.current) clearInterval(timer.current);

    if (!isLive) {
      const currentQ = poll?.questions?.[questionIdx] ?? null;
      const opts =
        currentQ?.options?.length
          ? currentQ.options
          : poll && Array.isArray(poll.options) && poll.options.length
          ? poll.options
          : ['한식', '양식', '중식', '일식'];
      setCounts(Object.fromEntries(opts.map((o, i) => [o, [34, 21, 13, 6][i] ?? 4])));
      setClusters([
        { id: '1', label: '분위기 중시', member_count: 9, summary: '조용하고 편한 분위기를 선호한다는 의견' },
        { id: '2', label: '가격 고려', member_count: 7, summary: '합리적인 가격대를 원한다는 의견' },
        { id: '3', label: '거리 우선', member_count: 5, summary: '사무실에서 가까운 곳을 원한다는 의견' },
        { id: '4', label: '건강식 선호', member_count: 4, summary: '채소 위주의 건강한 메뉴를 원한다는 의견' },
        { id: '5', label: '빠른 서비스', member_count: 3, summary: '점심시간이 짧아 빨리 나오는 곳을 원한다는 의견' },
      ]);
      timer.current = setInterval(() => {
        setCounts((c) => {
          const keys = Object.keys(c);
          if (!keys.length) return c;
          const k = keys[Math.floor(Math.random() * keys.length)];
          return { ...c, [k]: c[k] + 1 + Math.floor(Math.random() * 2) };
        });
      }, 2600);
      return () => clearInterval(timer.current);
    }

    if (!poll?.id) return;
    let unsubR = () => {};
    let unsubC = () => {};

    fetchChoiceResponses(poll.id, questionIdx)
      .then((rows) => {
        const tally = {};
        for (const r of rows) {
          if (r.choice_value) tally[r.choice_value] = (tally[r.choice_value] || 0) + 1;
        }
        setCounts(tally);
      })
      .catch(() => {});
    fetchClusters(poll.id, questionIdx).then(setClusters).catch(() => {});

    unsubR = subscribeResponses(poll.id, (row) => {
      if (row.poll_id !== poll.id) return;
      if (row.question_idx !== questionIdx) return;
      if (row.kind === 'choice' && row.choice_value) {
        setCounts((c) => ({ ...c, [row.choice_value]: (c[row.choice_value] || 0) + 1 }));
      }
    });
    unsubC = subscribeClusters(poll.id, () => {
      fetchClusters(poll.id, questionIdx).then(setClusters).catch(() => {});
    });

    // Polling fallback: re-fetch every 5s in case Realtime misses events
    timer.current = setInterval(() => {
      fetchChoiceResponses(poll.id, questionIdx)
        .then((rows) => {
          const tally = {};
          for (const r of rows) {
            if (r.choice_value) tally[r.choice_value] = (tally[r.choice_value] || 0) + 1;
          }
          setCounts(tally);
        })
        .catch(() => {});
      fetchClusters(poll.id, questionIdx).then(setClusters).catch(() => {});
    }, 5000);

    return () => { unsubR(); unsubC(); clearInterval(timer.current); };
  }, [poll?.id, questionIdx]);

  const currentQ = poll?.questions?.[questionIdx];
  const options =
    currentQ?.options?.length
      ? currentQ.options
      : poll && Array.isArray(poll.options) && poll.options.length
      ? poll.options
      : Object.keys(counts);
  const barData = options.map((o) => ({ option: o, count: counts[o] || 0 }));
  const bubbleData = clusters.map((c) => ({
    label: c.label || '묶는 중…',
    member_count: c.member_count,
    summary: c.summary,
  }));
  const total = {
    votes: barData.reduce((s, b) => s + b.count, 0),
    resp: clusters.reduce((s, c) => s + c.member_count, 0),
  };
  return { barData, bubbleData, total };
}

// ── Utility components ────────────────────────────────────────────────────────
function Card({ children }) {
  return <div style={{ border: '1px solid var(--lp-border)', borderRadius: 12, padding: 22 }}>{children}</div>;
}
function CardHead({ title, meta }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--lp-faint)', fontWeight: 600 }}>{meta}</div>
    </div>
  );
}
function SectionLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-faint)', letterSpacing: '.06em', marginBottom: 14 }}>{children}</div>;
}
function FieldLabel({ children, style }) {
  return <div style={{ fontSize: 12, color: 'var(--lp-muted)', marginBottom: 6, fontWeight: 600, ...style }}>{children}</div>;
}
function inputStyle(focus) {
  return { width: '100%', border: `1.5px solid ${focus ? 'var(--lp-primary)' : 'var(--lp-border)'}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, fontWeight: 600, outline: 'none' };
}

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPoll, isLive, submitResponse } from '../../lib/api';

const PIN_LEN = 6;

const DEMO_POLL = {
  id: 'demo',
  pin: '482901',
  title: '오늘 점심 메뉴는 어디로 할까요?',
  question_type: 'both',
  options: ['한식', '양식', '중식', '일식'],
  questions: [
    { title: '오늘 점심 메뉴는 어디로 할까요?', question_type: 'both', options: ['한식', '양식', '중식', '일식'] },
    { title: '선호하는 분위기는 어떤가요?', question_type: 'choice', options: ['조용한 곳', '활기찬 곳', '상관없음'] },
  ],
};

function getVoterId() {
  let id = localStorage.getItem('lp_voter_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('lp_voter_id', id);
  }
  return id;
}

function saveVotedPoll(pollId) {
  try {
    const voted = JSON.parse(localStorage.getItem('lp_voted_polls') || '[]');
    if (!voted.includes(pollId)) {
      localStorage.setItem('lp_voted_polls', JSON.stringify([...voted, pollId]));
    }
  } catch {}
}

function hasVotedForPoll(pollId) {
  try {
    return JSON.parse(localStorage.getItem('lp_voted_polls') || '[]').includes(pollId);
  } catch {
    return false;
  }
}

function JoinInner() {
  const searchParams = useSearchParams();
  const pinFromUrl = (searchParams.get('pin') || '').replace(/\D/g, '').slice(0, PIN_LEN);

  const [stage, setStage] = useState('pin');
  const [pin, setPin] = useState(pinFromUrl);
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);

  // Auto-submit when a valid PIN arrives from URL
  useEffect(() => {
    if (pinFromUrl.length === PIN_LEN) {
      enter(pinFromUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function enter(overridePin) {
    const activePin = overridePin ?? pin;
    if (activePin.length !== PIN_LEN) return;
    setBusy(true);
    setError('');
    try {
      if (isLive) {
        const { poll: p } = await getPoll(activePin);
        setPoll(p);
        if (hasVotedForPoll(p.id)) {
          setAlreadyVoted(true);
          setStage('done');
          return;
        }
      } else {
        await new Promise((r) => setTimeout(r, 400));
        setPoll(DEMO_POLL);
      }
      setStage('question');
    } catch (e) {
      setError(e.message || '투표를 찾을 수 없어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!isLive && (
        <div className="lp-demo-banner">
          데모 모드 — Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)를 설정하면 실제 백엔드에 연결됩니다.
        </div>
      )}
      <Phone pin={poll?.pin ? `PIN ${poll.pin.slice(0, 3)}·` : 'LivePoll'}>
        {stage === 'pin' && (
          <PinStep pin={pin} setPin={setPin} onEnter={() => enter()} busy={busy} error={error} />
        )}
        {stage === 'question' && (
          <QuestionStep
            poll={poll}
            onDone={(wasAlreadyVoted) => {
              setAlreadyVoted(wasAlreadyVoted);
              setStage('done');
            }}
          />
        )}
        {stage === 'done' && <DoneStep alreadyVoted={alreadyVoted} />}
      </Phone>
    </>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinInner />
    </Suspense>
  );
}

function Phone({ children, pin }) {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    setTime(fmt());
    const t = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--lp-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 340,
        maxWidth: '100%',
        background: '#fff',
        borderRadius: 28,
        boxShadow: '0 8px 30px rgba(15,23,42,.12)',
        padding: 14,
        border: '1px solid var(--lp-border)',
      }}>
        <div style={{
          borderRadius: 18,
          overflow: 'hidden',
          background: 'var(--lp-bg)',
          minHeight: 600,
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '14px 20px 0',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--lp-faint)',
          }}>
            <span>{time}</span>
            <span>{pin}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function PinStep({ pin, setPin, onEnter, busy, error }) {
  const cells = Array.from({ length: PIN_LEN }, (_, i) => pin[i] ?? '');
  const caret = pin.length;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 28 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--lp-primary)', letterSpacing: '.08em', marginBottom: 8 }}>
        투표 입장
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.25, marginBottom: 28 }}>
        6자리 PIN을<br />입력하세요
      </div>

      <div style={{ display: 'flex', gap: 9, marginBottom: 14 }}>
        {cells.map((c, i) => {
          const filled = c !== '';
          const active = i === caret;
          return (
            <div key={i} style={{
              flex: 1, aspectRatio: '1', borderRadius: 12, background: '#fff',
              border: `2px solid ${filled || active ? 'var(--lp-primary)' : 'var(--lp-border)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 800, color: 'var(--lp-ink)',
            }}>
              {filled ? c : active ? (
                <span style={{ color: 'var(--lp-primary)', animation: 'lp-pulse 1.1s ease-in-out infinite' }}>|</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <input
        autoFocus
        type="tel"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LEN))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder="숫자 6자리"
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 12,
          border: '1.5px solid var(--lp-border)', fontSize: 16,
          textAlign: 'center', letterSpacing: '.3em', marginBottom: 14, outline: 'none',
        }}
      />

      {error && (
        <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 14, textAlign: 'center' }}>
          {error}
        </div>
      )}

      <button className="lp-btn lp-btn--primary" onClick={onEnter} disabled={pin.length !== PIN_LEN || busy}>
        {busy ? '입장 중…' : '입장하기'}
      </button>
    </div>
  );
}

function QuestionStep({ poll, onDone }) {
  // Normalise to questions array (supports legacy single-question polls)
  const questions =
    poll.questions && poll.questions.length > 0
      ? poll.questions
      : [{ title: poll.title, question_type: poll.question_type, options: poll.options }];

  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const currentQ = questions[qIdx];
  const isLastQ = qIdx === questions.length - 1;
  const showChoice = currentQ.question_type === 'choice' || currentQ.question_type === 'both';
  const showOpen = currentQ.question_type === 'open' || currentQ.question_type === 'both';
  const options = Array.isArray(currentQ.options) ? currentQ.options : [];

  // For "both": at least one of choice/open must be filled (open is supplementary)
  const canAdvance = showChoice && showOpen
    ? (selected !== null || text.trim().length > 0)
    : (!showChoice || selected !== null) && (!showOpen || text.trim().length > 0);

  const submittingRef = React.useRef(false);

  async function submitAndAdvance() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (isLive) {
        const voter_id = getVoterId();
        if (showChoice && selected !== null) {
          await submitResponse({ poll_id: poll.id, kind: 'choice', choice_value: options[selected], voter_id, question_idx: qIdx });
        }
        if (showOpen && text.trim()) {
          await submitResponse({ poll_id: poll.id, kind: 'open', text: text.trim(), voter_id, question_idx: qIdx });
        }
        // Mark as voted after first question so re-entry shows DoneStep
        saveVotedPoll(poll.id);
      } else {
        await new Promise((r) => setTimeout(r, 300));
      }

      if (isLastQ) {
        onDone(false);
      } else {
        setQIdx((q) => q + 1);
        setSelected(null);
        setText('');
      }
    } catch (e) {
      if (e.message === 'already_voted') {
        saveVotedPoll(poll.id);
        onDone(true);
      } else {
        setError(e.message || '제출에 실패했어요');
      }
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24 }}>
      {/* Progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-faint)', letterSpacing: '.06em' }}>
          {showOpen && !showChoice ? '자유 의견' : `질문 ${qIdx + 1} / ${questions.length}`}
        </div>
        {questions.length > 1 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {questions.map((_, i) => (
              <div key={i} style={{
                width: i === qIdx ? 18 : 6, height: 6, borderRadius: 3,
                background: i <= qIdx ? 'var(--lp-primary)' : 'var(--lp-border)',
                transition: 'width .2s',
              }} />
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 22 }}>
        {currentQ.title}
      </div>

      {showChoice && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {options.map((opt, i) => {
            const on = selected === i;
            return (
              <button key={i} onClick={() => setSelected(i)} style={{
                textAlign: 'left',
                background: on ? 'var(--lp-primary)' : '#fff',
                color: on ? '#fff' : 'var(--lp-ink)',
                border: on ? 'none' : '1.5px solid var(--lp-border)',
                borderRadius: 14, padding: 18, fontSize: 17,
                fontWeight: on ? 700 : 600,
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: on ? '0 4px 14px rgba(52,83,140,.3)' : 'none',
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  border: `2px solid ${on ? '#fff' : 'var(--lp-border)'}`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flex: 'none',
                }}>
                  {on ? '✓' : ''}
                </span>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {showOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginTop: showChoice ? 16 : 0 }}>
          <textarea
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
            placeholder={showChoice ? '위 보기에 없으면 여기에 자유롭게 적어주세요 (선택)' : '의견을 자유롭게 적어주세요'}
            style={{
              flex: 1, minHeight: 100, resize: 'none', background: '#fff',
              border: '1.5px solid var(--lp-primary)', borderRadius: 14,
              padding: 18, fontSize: 16, lineHeight: 1.5, outline: 'none',
              boxShadow: '0 0 0 4px rgba(52,83,140,.1)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'var(--lp-faint)', margin: '6px 2px 0' }}>
            {text.length} / 200
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginTop: 12 }}>
          {error}
        </div>
      )}

      <button
        className="lp-btn lp-btn--ink"
        onClick={submitAndAdvance}
        disabled={!canAdvance || busy}
        style={{ marginTop: showOpen ? 12 : 'auto' }}
      >
        {busy ? '처리 중…' : isLastQ ? '제출하기' : '다음 질문'}
      </button>
    </div>
  );
}

function DoneStep({ alreadyVoted }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--lp-primary)' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 36, textAlign: 'center',
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'rgba(255,255,255,.16)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 28,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#fff', color: 'var(--lp-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, fontWeight: 800,
          }}>
            ✓
          </div>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12 }}>
          {alreadyVoted ? '이미 참여 완료!' : '제출 완료!'}
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,.82)', lineHeight: 1.5 }}>
          {alreadyVoted ? '이미 이 투표에 참여하셨습니다.' : '응답이 등록되었어요.'}<br />
          결과는 발표 화면에서 확인하세요.
        </div>
      </div>
      {!alreadyVoted && (
        <div style={{ padding: 24 }}>
          <div style={{
            background: 'rgba(255,255,255,.16)', color: '#fff',
            textAlign: 'center', padding: 16, borderRadius: 14,
            fontSize: 16, fontWeight: 700,
          }}>
            다음 질문 대기 중…
          </div>
        </div>
      )}
    </div>
  );
}

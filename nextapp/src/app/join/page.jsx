'use client';

import React, { useState } from 'react';
import { getPoll, isLive, submitResponse } from '../../lib/api';

const PIN_LEN = 6;

const DEMO_POLL = {
  id: 'demo',
  pin: '482901',
  title: '신규 기능을 예정대로 출시할까요?',
  question_type: 'both',
  options: ['예정대로 진행', '일정 연기', '범위 축소', '잘 모르겠음'],
};

export default function JoinPage() {
  const [stage, setStage] = useState('pin');
  const [pin, setPin] = useState('');
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function enter() {
    if (pin.length !== PIN_LEN) return;
    setBusy(true);
    setError('');
    try {
      if (isLive) {
        const { poll } = await getPoll(pin);
        setPoll(poll);
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
          <PinStep pin={pin} setPin={setPin} onEnter={enter} busy={busy} error={error} />
        )}
        {stage === 'question' && (
          <QuestionStep poll={poll} onDone={() => setStage('done')} />
        )}
        {stage === 'done' && <DoneStep />}
      </Phone>
    </>
  );
}

function Phone({ children, pin, dark = false }) {
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
          background: dark ? 'var(--lp-primary)' : 'var(--lp-bg)',
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
            color: dark ? 'rgba(255,255,255,.7)' : 'var(--lp-faint)',
          }}>
            <span>9:41</span>
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
        inputMode="numeric"
        pattern="[0-9]*"
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
  const showChoice = poll.question_type === 'choice' || poll.question_type === 'both';
  const showOpen = poll.question_type === 'open' || poll.question_type === 'both';

  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const options = Array.isArray(poll.options) ? poll.options : [];
  const canSubmit = (!showChoice || selected !== null) && (!showOpen || text.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (isLive) {
        if (showChoice && selected !== null) {
          await submitResponse({ poll_id: poll.id, kind: 'choice', choice_value: options[selected] });
        }
        if (showOpen && text.trim()) {
          await submitResponse({ poll_id: poll.id, kind: 'open', text: text.trim() });
        }
      } else {
        await new Promise((r) => setTimeout(r, 450));
      }
      onDone();
    } catch (e) {
      setError(e.message || '제출에 실패했어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--lp-faint)', letterSpacing: '.06em', marginBottom: 10 }}>
        {showOpen && !showChoice ? '자유 의견' : '질문 1 / 1'}
      </div>
      <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.01em', lineHeight: 1.3, marginBottom: 22 }}>
        {poll.title}
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
            placeholder="의견을 자유롭게 적어주세요"
            style={{
              flex: 1, minHeight: 120, resize: 'none', background: '#fff',
              border: '1.5px solid var(--lp-primary)', borderRadius: 14,
              padding: 18, fontSize: 17, lineHeight: 1.5, outline: 'none',
              boxShadow: '0 0 0 4px rgba(52,83,140,.1)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: 'var(--lp-faint)', margin: '8px 2px 0' }}>
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
        onClick={submit}
        disabled={!canSubmit || busy}
        style={{ marginTop: showOpen ? 16 : 'auto' }}
      >
        {busy ? '제출 중…' : '제출하기'}
      </button>
    </div>
  );
}

function DoneStep() {
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
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 12 }}>제출 완료!</div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,.82)', lineHeight: 1.5 }}>
          응답이 등록되었어요.<br />결과는 발표 화면에서 확인하세요.
        </div>
      </div>
      <div style={{ padding: 24 }}>
        <div style={{
          background: 'rgba(255,255,255,.16)', color: '#fff',
          textAlign: 'center', padding: 16, borderRadius: 14,
          fontSize: 16, fontWeight: 700,
        }}>
          다음 질문 대기 중…
        </div>
      </div>
    </div>
  );
}

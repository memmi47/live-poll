import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import BarResults from '../components/BarResults';
import BubbleResults from '../components/BubbleResults';
import {
  createPoll,
  fetchChoiceResponses,
  fetchClusters,
  isLive,
  subscribeClusters,
  subscribeResponses,
} from '../lib/api';

export default function Admin() {
  const [poll, setPoll] = useState(null);

  return (
    <div style={{ minHeight: '100vh', background: '#e7e5df', padding: 32 }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <TopHeading />
        <div
          style={{
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 8px 30px rgba(15,23,42,.10)',
            overflow: 'hidden',
            border: '1px solid var(--lp-border)',
          }}
        >
          <DashboardBar poll={poll} />
          <div style={{ display: 'flex', gap: 28, padding: 28, flexWrap: 'wrap' }}>
            <CreatePanel poll={poll} setPoll={setPoll} />
            <ResultsPanel poll={poll} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TopHeading() {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 13,
          letterSpacing: '.14em',
          fontWeight: 700,
          color: 'var(--lp-primary)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        LivePoll · 관리자
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em' }}>
          대시보드
        </div>
        <Link to="/" style={{ fontSize: 14, color: 'var(--lp-muted)', fontWeight: 600 }}>
          참여자 화면 →
        </Link>
      </div>
    </div>
  );
}

function DashboardBar({ poll }) {
  const participants = poll?.participants ?? (isLive ? 0 : 74);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 28px',
        borderBottom: '1px solid var(--lp-surface)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'var(--lp-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 16,
          }}
        >
          L
        </div>
        <span style={{ fontSize: 18, fontWeight: 800 }}>LivePoll 관리자</span>
      </div>
      <span className="lp-live">
        <span className="lp-live__dot" />
        LIVE · {participants}명 참여 중
      </span>
    </div>
  );
}

/* ── Create poll panel ─────────────────────────────────────────────────────── */
function CreatePanel({ poll, setPoll }) {
  const [title, setTitle] = useState('신규 기능을 예정대로 출시할까요?');
  const [type, setType] = useState('choice');
  const [options, setOptions] = useState(['예정대로 진행', '일정 연기']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const showOptions = type === 'choice' || type === 'both';

  function setOpt(i, v) {
    setOptions((o) => o.map((x, idx) => (idx === i ? v : x)));
  }
  function addOpt() {
    setOptions((o) => [...o, '']);
  }
  function removeOpt(i) {
    setOptions((o) => o.filter((_, idx) => idx !== i));
  }

  async function create() {
    setBusy(true);
    setError('');
    const cleanOpts = options.map((o) => o.trim()).filter(Boolean);
    try {
      if (isLive) {
        const { poll } = await createPoll({
          title: title.trim(),
          question_type: type,
          options: showOptions ? cleanOpts : [],
        });
        setPoll({ ...poll, participants: 0 });
      } else {
        await new Promise((r) => setTimeout(r, 350));
        setPoll({
          id: 'demo',
          pin: '482901',
          title: title.trim(),
          question_type: type,
          options: showOptions ? cleanOpts : [],
          participants: 74,
        });
      }
    } catch (e) {
      setError(e.message || '생성에 실패했어요');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 'none', width: 320, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ border: '1px solid var(--lp-border)', borderRadius: 12, padding: 20 }}>
        <SectionLabel>투표 만들기</SectionLabel>

        <FieldLabel>제목</FieldLabel>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={inputStyle(true)}
        />

        <FieldLabel style={{ marginTop: 16 }}>유형</FieldLabel>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[
            ['choice', '객관식'],
            ['open', '주관식'],
            ['both', '둘 다'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setType(val)}
              style={{
                flex: 1,
                background: type === val ? 'var(--lp-primary)' : 'var(--lp-surface)',
                color: type === val ? '#fff' : 'var(--lp-muted)',
                textAlign: 'center',
                padding: 10,
                borderRadius: 9,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {showOptions && (
          <>
            <FieldLabel>보기</FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={opt}
                    onChange={(e) => setOpt(i, e.target.value)}
                    placeholder={`보기 ${i + 1}`}
                    style={inputStyle(false)}
                  />
                  {options.length > 1 && (
                    <button
                      onClick={() => removeOpt(i)}
                      style={{
                        background: 'transparent',
                        color: 'var(--lp-faint)',
                        fontSize: 18,
                        padding: '0 4px',
                      }}
                      aria-label="보기 삭제"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addOpt}
                style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: 9,
                  padding: '10px 12px',
                  fontSize: 14,
                  color: 'var(--lp-faint)',
                  background: 'transparent',
                  textAlign: 'left',
                }}
              >
                + 보기 추가
              </button>
            </div>
          </>
        )}

        {error && (
          <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
            {error}
          </div>
        )}

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
    <div
      style={{
        border: '1px solid var(--lp-border)',
        borderRadius: 12,
        padding: 20,
        background: 'var(--lp-bg)',
      }}
    >
      <SectionLabel>참여 안내</SectionLabel>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div
          style={{
            flex: 'none',
            width: 96,
            height: 96,
            borderRadius: 12,
            background: '#fff',
            border: '1px solid var(--lp-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#cbd5e1',
            fontSize: 11,
            textAlign: 'center',
            lineHeight: 1.4,
          }}
        >
          QR
          <br />
          자리
        </div>
        <div>
          <div style={{ fontSize: 12, color: 'var(--lp-muted)', fontWeight: 600, marginBottom: 4 }}>
            PIN 코드
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: '.12em',
              color: 'var(--lp-primary)',
            }}
          >
            {formatted}
          </div>
          <div style={{ fontSize: 12, color: 'var(--lp-faint)', marginTop: 4 }}>
            livepoll.app 에서 입력
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Results panel ─────────────────────────────────────────────────────────── */
function ResultsPanel({ poll }) {
  const { barData, bubbleData, total } = usePollResults(poll);

  const showBars = !poll || poll.question_type === 'choice' || poll.question_type === 'both';
  const showBubbles = !poll || poll.question_type === 'open' || poll.question_type === 'both';

  return (
    <div style={{ flex: 1, minWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {showBars && (
        <Card>
          <CardHead title="객관식 결과 · 막대그래프" meta={`총 ${total.votes}표`} />
          <BarResults data={barData} />
        </Card>
      )}

      {showBubbles && (
        <Card>
          <CardHead
            title="주관식 결과 · 버블"
            meta={`의견 묶음 · ${total.resp}명`}
          />
          <div style={{ fontSize: 12, color: 'var(--lp-faint)', marginBottom: 6 }}>
            버블에 마우스를 올리면 요약이 보입니다
          </div>
          <BubbleResults data={bubbleData} />
        </Card>
      )}

      {poll && (
        <Link
          to={`/stage?pin=${poll.pin}`}
          className="lp-btn lp-btn--ghost"
          style={{ textDecoration: 'none', fontSize: 15, padding: 14 }}
        >
          🖥️ 발표 화면(무대 모드) 열기
        </Link>
      )}
    </div>
  );
}

/**
 * Live results hook. In live mode it seeds from the tables then keeps state in
 * sync via Realtime; in demo mode it simulates incoming votes locally.
 */
function usePollResults(poll) {
  const [counts, setCounts] = useState({});
  const [clusters, setClusters] = useState([]);
  const timer = useRef(null);

  useEffect(() => {
    setCounts({});
    setClusters([]);
    if (timer.current) clearInterval(timer.current);

    // ── Demo mode: simulate a live room ──────────────────────────────────────
    if (!isLive) {
      const opts =
        poll && Array.isArray(poll.options) && poll.options.length
          ? poll.options
          : ['예정대로 진행', '일정 연기', '범위 축소', '잘 모르겠음'];
      setCounts(Object.fromEntries(opts.map((o, i) => [o, [34, 21, 13, 6][i] ?? 4])));
      setClusters([
        { id: '1', label: '비용 절감', member_count: 9, summary: '운영비를 줄일 수 있다는 의견' },
        { id: '2', label: '안정성 우려', member_count: 7, summary: '초기 안정성이 걱정된다는 의견' },
        { id: '3', label: '속도 개선', member_count: 5, summary: '처리 속도가 빨라질 것이라는 기대' },
        { id: '4', label: '사용성', member_count: 4, summary: '더 쓰기 쉬워졌으면 한다는 의견' },
        { id: '5', label: '교육 필요', member_count: 3, summary: '팀 교육이 선행돼야 한다는 의견' },
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

    // ── Live mode: seed + subscribe ──────────────────────────────────────────
    if (!poll?.id) return;
    let unsubR = () => {};
    let unsubC = () => {};

    fetchChoiceResponses(poll.id)
      .then((rows) => {
        const tally = {};
        for (const r of rows) {
          if (r.choice_value) tally[r.choice_value] = (tally[r.choice_value] || 0) + 1;
        }
        setCounts(tally);
      })
      .catch(() => {});
    fetchClusters(poll.id).then(setClusters).catch(() => {});

    unsubR = subscribeResponses(poll.id, (row) => {
      if (row.kind === 'choice' && row.choice_value) {
        setCounts((c) => ({ ...c, [row.choice_value]: (c[row.choice_value] || 0) + 1 }));
      }
    });
    unsubC = subscribeClusters(poll.id, () => {
      fetchClusters(poll.id).then(setClusters).catch(() => {});
    });

    return () => {
      unsubR();
      unsubC();
    };
  }, [poll?.id, isLive]);

  // Shape into the props the handoff chart components expect.
  const options =
    poll && Array.isArray(poll.options) && poll.options.length
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

/* ── small presentational helpers ──────────────────────────────────────────── */
function Card({ children }) {
  return (
    <div style={{ border: '1px solid var(--lp-border)', borderRadius: 12, padding: 22 }}>
      {children}
    </div>
  );
}
function CardHead({ title, meta }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--lp-faint)', fontWeight: 600 }}>{meta}</div>
    </div>
  );
}
function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--lp-faint)',
        letterSpacing: '.06em',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}
function FieldLabel({ children, style }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--lp-muted)', marginBottom: 6, fontWeight: 600, ...style }}>
      {children}
    </div>
  );
}
function inputStyle(focus) {
  return {
    width: '100%',
    border: `1.5px solid ${focus ? 'var(--lp-primary)' : 'var(--lp-border)'}`,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 15,
    fontWeight: 600,
    outline: 'none',
  };
}

import React, { useState } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  Cell, Tooltip,
} from 'recharts';
import { tokens } from '../tokens';

/**
 * 주관식 실시간 결과 — 버블 차트.
 * 버블 크기는 member_count 에 비례합니다.
 *
 * @param {{ label: string, member_count: number, summary?: string }[]} data
 *        의견 묶음 목록.
 *        예: [{ label: '비용 절감', member_count: 9, summary: '운영비 절감 의견' }]
 *        ⚠️ 이 props 형태는 변경하지 마세요. 데이터는 외부에서 주입됩니다.
 * @param {boolean} [stage=false]  true면 다크 무대(프로젝터) 스타일.
 * @param {string[]} [colors]      버블 색 (기본: 토큰 차트 팔레트 순환).
 *
 * 마우스를 올리면 summary 가 툴팁으로 표시됩니다.
 * 데이터 fetch 로직 없음 — 모양만 담당합니다.
 */
export default function BubbleResults({ data = [], stage = false }) {
  if (!data.length) {
    return <EmptyBubble stage={stage} />;
  }

  // 무지개색 ❌ → 네이비 단일 색상 명도 스케일 (큰 묶음일수록 진함)
  const scale = tokens.color.bubbleScale;

  // 결정적(seeded) 위치 배치 — 큰 버블이 가운데로 오도록 정렬 후 흩뿌립니다.
  const sorted = [...data].sort((a, b) => b.member_count - a.member_count);
  const slots = [
    { x: 50, y: 50 }, { x: 28, y: 40 }, { x: 72, y: 58 },
    { x: 44, y: 78 }, { x: 76, y: 28 }, { x: 22, y: 72 },
    { x: 60, y: 22 }, { x: 84, y: 80 },
  ];
  const points = sorted.map((d, i) => ({
    ...d,
    x: (slots[i % slots.length] || { x: 50 }).x,
    y: (slots[i % slots.length] || { y: 50 }).y,
    z: d.member_count,
    color: scale[i] || scale[scale.length - 1],
  }));

  const maxCount = Math.max(...data.map((d) => d.member_count), 1);

  return (
    <ResponsiveContainer width="100%" height={stage ? 460 : 320}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <XAxis type="number" dataKey="x" domain={[0, 100]} hide />
        <YAxis type="number" dataKey="y" domain={[0, 100]} hide />
        <ZAxis type="number" dataKey="z" range={stage ? [1400, 14000] : [700, 7000]} domain={[0, maxCount]} />
        <Tooltip
          cursor={false}
          content={<BubbleTooltip stage={stage} />}
        />
        <Scatter
          data={points}
          isAnimationActive
          animationDuration={700}
          animationEasing="ease-out"
        >
          {points.map((p, i) => (
            <Cell key={i} fill={p.color} fillOpacity={0.95} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** 호버 시 label + member_count + summary 표시. */
function BubbleTooltip({ active, payload, stage }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: tokens.color.ink, color: '#fff', padding: '10px 14px',
      borderRadius: tokens.radius.sm, fontFamily: tokens.font,
      boxShadow: '0 6px 18px rgba(0,0,0,.25)', maxWidth: 240,
    }}>
      <div style={{ fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.black }}>
        {d.label} · {d.member_count}명
      </div>
      {d.summary && (
        <div style={{ fontSize: tokens.fontSize.label, color: '#CBD5E1', marginTop: 4, lineHeight: 1.4 }}>
          {d.summary}
        </div>
      )}
    </div>
  );
}

/** 빈 상태 — 아직 응답이 없을 때. */
function EmptyBubble({ stage }) {
  const fg = stage ? '#94A3B8' : tokens.color.faint;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, height: stage ? 460 : 320, borderRadius: tokens.radius.md,
      border: `1.5px dashed ${stage ? '#1E293B' : tokens.color.border}`,
      background: stage ? 'transparent' : tokens.color.bg, fontFamily: tokens.font,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {[44, 64, 36].map((s, i) => (
          <div key={i} style={{
            width: s, height: s, borderRadius: '50%',
            background: stage ? '#1E293B' : tokens.color.border,
            animation: `lpPulse 1.6s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <div style={{ fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.bold, color: stage ? '#E2E8F0' : tokens.color.ink }}>
        의견을 모으는 중
      </div>
      <div style={{ fontSize: tokens.fontSize.label, color: fg, textAlign: 'center', lineHeight: 1.5 }}>
        주관식 응답이 들어오면 버블로 묶여 표시돼요
      </div>
      <style>{`@keyframes lpPulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
    </div>
  );
}

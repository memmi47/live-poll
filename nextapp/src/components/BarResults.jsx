'use client';

import React from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Cell, LabelList,
} from 'recharts';
import { tokens } from '../tokens';

export default function BarResults({ data = [], stage = false }) {
  if (!data.length) {
    return <EmptyBar stage={stage} />;
  }

  const scale = stage ? tokens.color.scaleStage : tokens.color.scale;
  const accent = stage ? tokens.color.accentStage : tokens.color.accent;
  const order = data.map((d, i) => i).sort((a, b) => (data[b].count || 0) - (data[a].count || 0));
  const rankOf = {};
  order.forEach((idx, r) => { rankOf[idx] = r; });
  const barColor = (i) => (rankOf[i] === 0 ? accent : scale[rankOf[i] - 1] || scale[scale.length - 1]);

  const total = data.reduce((sum, d) => sum + (d.count || 0), 0) || 1;
  const labelColor = stage ? '#FFFFFF' : tokens.color.ink;
  const tickColor = stage ? '#E2E8F0' : tokens.color.ink;
  const barBg = stage ? tokens.color.stagePanel : tokens.color.surface;

  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * (stage ? 76 : 54), 120)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 64, bottom: 8, left: 8 }}
        barCategoryGap={stage ? '30%' : '24%'}
      >
        <XAxis type="number" hide domain={[0, 'dataMax']} />
        <YAxis
          type="category"
          dataKey="option"
          width={stage ? 200 : 130}
          axisLine={false}
          tickLine={false}
          tick={{
            fill: tickColor,
            fontSize: stage ? tokens.fontSize.stageLabel : tokens.fontSize.body,
            fontWeight: tokens.fontWeight.bold,
            fontFamily: tokens.font,
          }}
        />
        <Bar
          dataKey="count"
          radius={[6, 6, 6, 6]}
          background={{ fill: barBg, radius: 6 }}
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={barColor(i)} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            formatter={(v) => `${v} · ${Math.round((v / total) * 100)}%`}
            style={{
              fill: labelColor,
              fontSize: stage ? tokens.fontSize.stageNumber : tokens.fontSize.body,
              fontWeight: tokens.fontWeight.black,
              fontFamily: tokens.font,
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function EmptyBar({ stage }) {
  const fg = stage ? '#94A3B8' : tokens.color.faint;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '40px 24px', borderRadius: tokens.radius.md,
      border: `1.5px dashed ${stage ? '#1E293B' : tokens.color.border}`,
      background: stage ? 'transparent' : tokens.color.bg, fontFamily: tokens.font,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 56 }}>
        {[24, 44, 34].map((h, i) => (
          <div key={i} style={{
            width: 30, height: h, borderRadius: 6,
            background: stage ? '#1E293B' : tokens.color.border,
            animation: `lpPulse 1.6s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <div style={{ fontSize: tokens.fontSize.body, fontWeight: tokens.fontWeight.bold, color: stage ? '#E2E8F0' : tokens.color.ink }}>
        응답을 기다리는 중
      </div>
      <div style={{ fontSize: tokens.fontSize.label, color: fg, textAlign: 'center', lineHeight: 1.5 }}>
        PIN을 공유하면 결과가 실시간으로 채워져요
      </div>
      <style>{`@keyframes lpPulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
    </div>
  );
}

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

function QrInner() {
  const params = useSearchParams();
  const pin = params.get('pin') || '';
  const formatted = pin.length === 6 ? `${pin.slice(0, 3)} · ${pin.slice(3)}` : pin;

  const [joinUrl, setJoinUrl] = useState('');
  useEffect(() => {
    if (pin) setJoinUrl(`${window.location.origin}/join?pin=${pin}`);
  }, [pin]);

  return (
    <div style={{
      minHeight: '100vh', background: '#0b1322',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 40, padding: 40, fontFamily: 'system-ui, sans-serif',
    }}>
      {/* QR code */}
      <div style={{
        background: '#fff', borderRadius: 24, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        {joinUrl ? (
          <QRCodeSVG value={joinUrl} size={260} />
        ) : (
          <div style={{ width: 260, height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            PIN 없음
          </div>
        )}
      </div>

      {/* PIN */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#64748b', letterSpacing: '.12em', marginBottom: 12 }}>
          참여 PIN
        </div>
        <div style={{ fontSize: 72, fontWeight: 900, color: '#fff', letterSpacing: '.18em', lineHeight: 1 }}>
          {formatted || '——'}
        </div>
      </div>

      {/* URL hint */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, color: '#475569', fontWeight: 600 }}>
          카메라로 스캔하거나
        </div>
        <div style={{ fontSize: 20, color: '#94a3b8', fontWeight: 700, marginTop: 6 }}>
          {joinUrl ? joinUrl.replace(/^https?:\/\//, '') : '—'}
        </div>
      </div>

      {/* Close hint */}
      <div
        onClick={() => window.close()}
        style={{
          position: 'fixed', bottom: 28, right: 32,
          fontSize: 13, color: '#334155', fontWeight: 600,
          cursor: 'pointer', letterSpacing: '.04em',
        }}
      >
        ESC · 닫기
      </div>
    </div>
  );
}

export default function QrPage() {
  return (
    <Suspense>
      <QrInner />
    </Suspense>
  );
}

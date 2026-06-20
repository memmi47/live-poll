import React from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import Voter from './screens/Voter';
import Admin from './screens/Admin';
import Stage from './screens/Stage';
import { isLive } from './lib/api';

export default function App() {
  return (
    <>
      {!isLive && (
        <div className="lp-demo-banner">
          데모 모드 — Supabase 환경변수(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)를 설정하면 실제 백엔드에 연결됩니다.
        </div>
      )}
      <Routes>
        <Route path="/" element={<Voter />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/stage" element={<Stage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function NotFound() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>페이지를 찾을 수 없어요</div>
      <Link to="/" style={{ color: 'var(--lp-primary)', fontWeight: 600 }}>
        참여자 화면으로 →
      </Link>
    </div>
  );
}

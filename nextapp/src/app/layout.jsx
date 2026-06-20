import '../globals.css';

export const metadata = {
  title: 'LivePoll',
  description: '실시간 라이브 투표 플랫폼',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

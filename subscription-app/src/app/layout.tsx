import './globals.css';

export const metadata = {
  title: 'Subscription App',
  description: 'Next.js + Postgres starter',
};

export default function RootLayout({ children }: any) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}

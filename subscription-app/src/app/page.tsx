'use client';
import { useState } from 'react';

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const create = async () => {
    setLoading(true); setMsg('');
    const r = await fetch('/api/subscriptions', { method:'POST', body: JSON.stringify({}) });
    const j = await r.json();
    setMsg(j.ok ? 'Subscription created' : ('Error: '+j.error));
    setLoading(false);
  };
  return (
    <main style={{maxWidth:740,margin:'40px auto',fontFamily:'system-ui'}}>
      <h1>Pro Plan</h1>
      <p>$29/month • 14-day trial</p>
      <button onClick={create} disabled={loading}>
        {loading? 'Creating…':'Start Trial'}
      </button>
      <p>{msg}</p>
      <p><a href="/dashboard">Go to dashboard →</a></p>
    </main>
  );
}

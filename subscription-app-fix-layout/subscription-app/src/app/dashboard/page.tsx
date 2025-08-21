'use client';
import { useState } from 'react';

export default function Dashboard() {
  const [msg, setMsg] = useState('');

  const post = async (url: string, body?: any) => {
    setMsg('');
    const r = await fetch(url, { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body||{}) });
    const j = await r.json();
    setMsg(j.ok ? 'OK' : ('Error: '+(j.error||'unknown')));
  };

  return (
    <main style={{maxWidth:900,margin:'40px auto',fontFamily:'system-ui'}}>
      <h1>Dashboard</h1>
      <div style={{display:'grid',gap:12,gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))'}}>
        <button onClick={()=>post('/api/invoices')}>Create Invoice</button>
        <button onClick={()=>post('/api/usage',{ qty: Math.floor(Math.random()*100)+1 })}>Log Random Usage</button>
      </div>
      <p style={{marginTop:16}}>{msg}</p>
      <p><a href="/admin">Admin →</a></p>
    </main>
  );
}

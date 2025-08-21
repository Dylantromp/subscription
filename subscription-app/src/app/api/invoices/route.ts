import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { invoiceForSubSql } from '@/lib/sql';

export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const { accountName = 'Airlec, Inc.' } = body || {};

  const sub = await query<{id:string}>(`
    SELECT s.id
    FROM subscriptions s
    JOIN accounts a ON a.id = s.account_id
    WHERE a.name=$1
    ORDER BY s.created_at DESC
    LIMIT 1
  `, [accountName]);
  if (!sub.rows[0]) return NextResponse.json({ error: 'No subscription' }, { status: 404 });

  await query(invoiceForSubSql, [sub.rows[0].id]);
  return NextResponse.json({ ok: true });
}

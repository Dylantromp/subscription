import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logUsageSql, rollupUsageSql } from '@/lib/sql';

export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const { accountName='Airlec, Inc.', meter='api_calls', qty=37 } = body || {};

  const s = await query<{id:string, account_id:string}>(`
    SELECT s.id, s.account_id
    FROM subscriptions s
    JOIN accounts a ON a.id = s.account_id
    WHERE a.name=$1
    ORDER BY s.created_at DESC
    LIMIT 1
  `, [accountName]);
  if (!s.rows[0]) return NextResponse.json({ error: 'No subscription' }, { status: 404 });

  const { id: subId, account_id: accountId } = s.rows[0];
  await query(logUsageSql, [accountId, subId, meter, Number(qty)]);
  await query(rollupUsageSql, [subId, meter]);

  return NextResponse.json({ ok: true });
}

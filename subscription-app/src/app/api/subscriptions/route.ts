import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { selectPlanPriceMonthly, createSubscriptionSql } from '@/lib/sql';

export async function POST(req: Request) {
  const body = await req.json().catch(()=>({}));
  const { accountName = 'Airlec, Inc.', planCode = 'pro' } = body || {};

  const acc = await query<{id:string}>(`SELECT id FROM accounts WHERE name=$1 LIMIT 1`, [accountName]);
  if (!acc.rows[0]) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  const accountId = acc.rows[0].id;

  const p = await query<{price_id:string; billing_period:string; interval_count:number; trial_days:number}>(selectPlanPriceMonthly, [planCode]);
  if (!p.rows[0]) return NextResponse.json({ error: 'Monthly price not found' }, { status: 404 });

  const { price_id, billing_period, interval_count, trial_days } = p.rows[0];
  await query(createSubscriptionSql, [ accountId, billing_period, interval_count, trial_days, price_id ]);

  return NextResponse.json({ ok: true });
}

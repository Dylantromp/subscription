import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { entitlementCheckSql } from '@/lib/sql';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get('subscriptionId');
  const feature = searchParams.get('feature') || 'projects.max';
  if (!subscriptionId) return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 });

  const res = await query<{raw_value:string | null}>(entitlementCheckSql, [subscriptionId, feature]);
  return NextResponse.json({ value: res.rows[0]?.raw_value ?? null });
}

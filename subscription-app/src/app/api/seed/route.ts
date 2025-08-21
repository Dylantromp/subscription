import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST() {
  const schema = fs.readFileSync(path.join(process.cwd(), 'sql/001_schema.sql'), 'utf8');
  const seed   = fs.readFileSync(path.join(process.cwd(), 'sql/002_seed.sql'), 'utf8');
  try {
    await query(schema);
    await query(seed);
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message }, { status: 500 });
  }
}

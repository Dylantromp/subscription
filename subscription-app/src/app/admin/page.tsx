import { query } from '@/lib/db';

export default async function Admin() {
  const { rows } = await query<{account_id:string; mrr_cents:number}>(`
    WITH active_subs AS (
      SELECT s.account_id, pr.unit_amount, pr.billing_period, pr.interval_count
      FROM subscriptions s
      JOIN subscription_items si ON si.subscription_id = s.id
      JOIN prices pr ON pr.id = si.price_id
      WHERE s.status IN ('trialing','active','past_due','paused')
    ),
    mrr AS (
      SELECT account_id,
             CASE
               WHEN billing_period='month' AND interval_count=1 THEN unit_amount
               WHEN billing_period='year'  AND interval_count=1 THEN (unit_amount / 12.0)::BIGINT
               WHEN billing_period='week'                          THEN (unit_amount * 52.0 / 12.0)::BIGINT
               ELSE unit_amount
             END AS mrr_cents
      FROM active_subs
    )
    SELECT account_id, SUM(mrr_cents) AS mrr_cents
    FROM mrr GROUP BY account_id ORDER BY mrr_cents DESC;
  `);

  return (
    <main style={{maxWidth:900,margin:'40px auto',fontFamily:'system-ui'}}>
      <h1>Admin</h1>
      <table style={{width:'100%',borderCollapse:'collapse'}}>
        <thead><tr><th style={{textAlign:'left'}}>Account</th><th style={{textAlign:'left'}}>MRR ($)</th></tr></thead>
        <tbody>
          {rows.map((r,i)=> (
            <tr key={i}><td>{r.account_id}</td><td>{(Number(r.mrr_cents||0)/100).toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

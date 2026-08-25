import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rank partners on cash collected, and stop leaking their revenue to each other.
 *
 * The original `partner_leaderboard()` (migration 1720000028000) had three
 * problems, all of which get worse the moment the programme has real partners:
 *
 *  1. It summed `vendor_subscriptions.mrr` for status IN ('active','trialing').
 *     That is subscribed MRR *including trials* — the same flaw already fixed in
 *     `CommissionsService.accrue()` (docs/LOCARE_COMMISSION_STRUCTURE.md §4).
 *     A partner could top the board on agencies that never paid a cent, and the
 *     board would disagree with their own commission statement.
 *
 *  2. It ranked partly on `partner_deals.stage = 'won'`, which the partner sets
 *     themselves by dragging a card. Self-reported input has no place in a
 *     public ranking.
 *
 *  3. It returned every partner's agency count and rand figures to every other
 *     partner. PARTNER_PORTAL_DESIGN.md §6.2 specifies display name, headline
 *     metric, rank and activity only — because a rival who knows the rate bands
 *     can turn another partner's MRR into their income.
 *
 * The replacement takes a caller id: rand detail is returned for that partner
 * only, and everyone else is reduced to rank, name and the headline metric.
 * Enforcing that in the function rather than by filtering in the API means the
 * data never leaves Postgres in the first place.
 */
export class LeaderboardCollected1720000042000 implements MigrationInterface {
  public async up(q: QueryRunner): Promise<void> {
    // Collected-per-partner-per-month, the shared basis for every window below.
    // Grouped on the month the money ARRIVED (paid_at), not the period invoiced
    // — an invoice for July settled in August is August's revenue, which is the
    // same rule accrual uses, so the board and the statement agree.
    await q.query(`
      CREATE OR REPLACE VIEW partner_collected_monthly AS
        SELECT vs.referred_by_partner_id AS partner_id,
               to_char(si.paid_at, 'YYYY-MM')  AS month,
               SUM(si.amount)                  AS collected,
               COUNT(DISTINCT si.vendor_id)    AS paying_agencies
          FROM subscription_invoices si
          JOIN vendor_subscriptions vs ON vs.vendor_id = si.vendor_id
         WHERE si.status = 'paid'
           AND si.paid_at IS NOT NULL
           AND vs.referred_by_partner_id IS NOT NULL
           AND vs.status <> 'trialing'
         GROUP BY 1, 2;`);

    await q.query(`
      CREATE OR REPLACE FUNCTION partner_leaderboard(p_caller uuid DEFAULT NULL,
                                                     p_window text DEFAULT 'month')
      RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        WITH bounds AS (
          SELECT CASE p_window
                   WHEN 'quarter' THEN to_char(date_trunc('quarter', now()), 'YYYY-MM')
                   WHEN 'all'     THEN '0000-00'
                   ELSE                to_char(now(), 'YYYY-MM')
                 END AS from_month,
                 to_char(now(), 'YYYY-MM')                                AS this_month,
                 to_char(now() - interval '1 month', 'YYYY-MM')           AS prev_month,
                 to_char(now() - interval '2 month', 'YYYY-MM')           AS m2
        ),
        -- Ranked on collected in the selected window.
        windowed AS (
          SELECT p.id AS partner_id, p.name,
                 COALESCE(SUM(c.collected), 0) AS collected
            FROM partners p
            LEFT JOIN partner_collected_monthly c
                   ON c.partner_id = p.id AND c.month >= (SELECT from_month FROM bounds)
           WHERE p.status = 'active'
           GROUP BY p.id, p.name
        ),
        -- Last month's ranking, purely to compute movement arrows.
        --
        -- Only meaningful against the 'month' window. Comparing a
        -- quarter-to-date or all-time position to last month alone would
        -- produce an arrow that means nothing, so those windows get NULL and
        -- the UI renders no arrow rather than a misleading one.
        previous AS (
          SELECT p.id AS partner_id,
                 CASE WHEN p_window = 'month'
                      THEN RANK() OVER (ORDER BY COALESCE(SUM(c.collected), 0) DESC, p.name)
                 END AS rank
            FROM partners p
            LEFT JOIN partner_collected_monthly c
                   ON c.partner_id = p.id AND c.month = (SELECT prev_month FROM bounds)
           WHERE p.status = 'active'
           GROUP BY p.id, p.name
        ),
        -- Rolling three months. This is the Reseller gate in
        -- LOCARE_COMMISSION_STRUCTURE.md §1: R15,000/month collected for three
        -- consecutive months. 'qualifying_months' counts months at or over the
        -- threshold, so the board shows real progress toward a rate change
        -- rather than a vanity total.
        rolling AS (
          SELECT p.id AS partner_id,
                 COALESCE(SUM(c.collected), 0)                                   AS collected_3m,
                 COUNT(*) FILTER (WHERE c.collected >= 15000)                     AS qualifying_months,
                 -- Months with any collected revenue, within the same rolling
                 -- three. Deliberately NOT called a streak: it maxes out at 3
                 -- and does not check consecutiveness, so labelling it one
                 -- would overstate a partner with a long record.
                 COUNT(*) FILTER (WHERE c.collected > 0)                          AS active_months
            FROM partners p
            LEFT JOIN partner_collected_monthly c
                   ON c.partner_id = p.id
                  AND c.month IN ((SELECT this_month FROM bounds),
                                  (SELECT prev_month FROM bounds),
                                  (SELECT m2 FROM bounds))
           WHERE p.status = 'active'
           GROUP BY p.id
        ),
        -- Live paying agencies. Excludes trialing deliberately: an unconverted
        -- trial is not an achievement, and counting it was how the old board
        -- could be gamed.
        agencies AS (
          SELECT vs.referred_by_partner_id AS partner_id, COUNT(*) AS live
            FROM vendor_subscriptions vs
           WHERE vs.referred_by_partner_id IS NOT NULL
             AND vs.status = 'active'
           GROUP BY 1
        ),
        ranked AS (
          SELECT w.partner_id, w.name, w.collected,
                 RANK() OVER (ORDER BY w.collected DESC, w.name) AS rank,
                 COALESCE(a.live, 0)               AS live_agencies,
                 COALESCE(r.collected_3m, 0)       AS collected_3m,
                 COALESCE(r.qualifying_months, 0)  AS qualifying_months,
                 COALESCE(r.active_months, 0)      AS streak_months,
                 pr.rank                            AS prev_rank
            FROM windowed w
            LEFT JOIN agencies a ON a.partner_id = w.partner_id
            LEFT JOIN rolling  r ON r.partner_id = w.partner_id
            LEFT JOIN previous pr ON pr.partner_id = w.partner_id
        )
        SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.rank), '[]'::json)
          FROM (
            SELECT rank,
                   name,
                   -- Identity is returned only for the caller's own row, so a
                   -- client cannot correlate a rand figure to a partner id.
                   CASE WHEN partner_id = p_caller THEN partner_id END AS "partnerId",
                   COALESCE(partner_id = p_caller, false)              AS "isSelf",
                   prev_rank                                           AS "prevRank",
                   live_agencies                                       AS "liveAgencies",
                   streak_months                                       AS "activeMonths",
                   -- Rand detail: caller only. Everyone else gets nulls, which
                   -- the UI renders as a rank and a name. See §6.2.
                   CASE WHEN partner_id = p_caller THEN collected END          AS "collected",
                   CASE WHEN partner_id = p_caller THEN collected_3m END       AS "collected3m",
                   CASE WHEN partner_id = p_caller THEN qualifying_months END  AS "qualifyingMonths"
              FROM ranked
          ) x;
      $$;`);

    // The old zero-argument signature is gone; nothing may call it unqualified
    // and silently get the un-scoped board back.
    await q.query(`DROP FUNCTION IF EXISTS partner_leaderboard();`);

    await q.query(`
      CREATE INDEX IF NOT EXISTS subscription_invoices_paid_at_idx
        ON subscription_invoices (paid_at) WHERE status = 'paid';`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS subscription_invoices_paid_at_idx;`);
    await q.query(`DROP FUNCTION IF EXISTS partner_leaderboard(uuid, text);`);
    await q.query(`DROP VIEW IF EXISTS partner_collected_monthly;`);
    await q.query(`
      CREATE OR REPLACE FUNCTION partner_leaderboard()
      RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
        SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x."referredMrr" DESC, x."agenciesSigned" DESC), '[]'::json)
        FROM (
          SELECT p.id AS "partnerId", p.name,
                 COALESCE(s.agencies, 0) AS "agenciesSigned",
                 COALESCE(s.mrr, 0)      AS "referredMrr",
                 COALESCE(d.won, 0)      AS "dealsWon"
          FROM partners p
          LEFT JOIN (
            SELECT referred_by_partner_id AS pid, COUNT(*) AS agencies, SUM(mrr) AS mrr
            FROM vendor_subscriptions
            WHERE referred_by_partner_id IS NOT NULL AND status IN ('active','trialing')
            GROUP BY referred_by_partner_id
          ) s ON s.pid = p.id
          LEFT JOIN (
            SELECT partner_id AS pid, COUNT(*) AS won FROM partner_deals WHERE stage = 'won' GROUP BY partner_id
          ) d ON d.pid = p.id
        ) x;
      $$;`);
  }
}

# Crawler

Visits every page of the back office as each account, in each language and
screen size, and reports what a person would only notice by looking: errors,
untranslated text, raw translation keys, R 0.00 columns, broken links into
hidden sections, overflow, slow pages. Read-only: it follows links and never
clicks a button, so it is safe against demo data.

```
npm run crawl
npm run crawl -- --account owner --locale zh-Hans --viewport desktop --max 20
```

Needs the stack up (API on 3000, web on 3001, Mailpit on 8025, `OTP_CHANNEL=email`).
Sign-in codes are read from Mailpit; set `OTP=123456` to supply one instead.

Report: `.crawl/<timestamp>/report.html` — one row per distinct problem, with
the pages it appeared on and a screenshot of each. Exit code 1 when there is
any error, so it can gate a nightly run.

Settings live in `crawl.config.json`: accounts, locales, viewports, page cap,
routes to `skip`, API calls to ignore (`ignoreApi`, regexes), and `allowWords`
— English that is correct on a Chinese screen (PDF, VAT, Google).

Flags: `--account`, `--locale`, `--viewport` (comma-separated, matching the
config), `--max`, `--base`, `--api`, `--mailpit`.

## Journeys — the part that clicks

`npm run journey -- billrun` drives the bill run through the real dashboard
button and checks the outcome end to end:

1. picks the next month with nothing billed (or `--period 2027-01`)
2. reads the expected rent from the active leases (and fails if a unit has two)
3. types the month on the dashboard and clicks **Run billing**
4. waits for the background run to settle
5. billed ≥ rent; the excess (utilities + VAT) is reported
6. one invoice email per tenant, nobody emailed twice
7. every email adds up: lines + VAT = total due = amount due; greeting has a
   name; utility lines present when the agency bills utilities
8. the emails' totals = the billed total in the ledger
9. clicks Run billing again: nothing new billed, no new emails

**It changes data.** A bill run invoices every active lease of the signed-in
agency for the month and emails its tenants, so it refuses any host but localhost unless
given `--allow-remote`. Run it against the local stack only. Report:
`.crawl/<timestamp>-billrun/report.html`, a screenshot per step.

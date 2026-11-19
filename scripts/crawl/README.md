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

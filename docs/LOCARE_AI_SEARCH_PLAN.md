# Locare — AI search visibility plan

Written 2026-11-13. Owner: Vernon. Read with `LOCARE_GUIDE_BACKLOG.md`.

The goal is narrow: when a South African agency principal asks an AI assistant
"what should I use to run my rental book", Locare should be one of the named
options, with a correct description. Not rankings for their own sake.

## The finding this plan is built on

Searched 2026-11-13 for the two queries that matter most:

- "best property management software for rental agencies South Africa" — the
  result set is almost entirely **directories and aggregators**: Capterra
  (co.za), GetApp, SoftwareAdvice, SoftwareSuggest, plus vendor-blog listicles
  (MRI). No independent editorial.
- "Locare property management software locare.co.za" — locare.co.za did **not
  surface**. The results were directory pages for other products, a `freedom251`
  app-listing page, and a `g2.com/products/locare/discuss` URL that needs
  checking: it may be a stub for a different product of the same name.

That is the whole problem in one line: **AI assistants answering these questions
read the aggregator corpus, and Locare is not in it.** The site itself is in
decent shape — 20 sitemap URLs, ten guides, four calculators, Organization /
SoftwareApplication / Article / FAQPage / Offer JSON-LD, `robots.txt` open to
all agents. More on-site SEO is not the lever. Being absent from the sources the
models quote is.

Supporting evidence, treated as weak: a vendor study of 1,200 B2B prompts
reports 72% of AI citations come from outside the top-3 organic results, i.e.
position on Google is not the gate. The same study's "entity triples are 4x more
citable" and llms.txt claims are self-reported with no method — do not plan
around them. On llms.txt specifically, an Ahrefs scan of 137k domains found 97%
of llms.txt files got zero AI-crawler traffic, and no major provider has
confirmed reading it. Treated here as a five-minute cheap bet, not a workstream.

## Standing constraints

Carried from the other Locare and BuddhaPets work, and not to be relitigated:

- **One agency live, no paying customers.** Never submit, write or imply a
  review, testimonial, customer count, rating or "trusted by" claim. Directory
  profiles get filled in without social proof, and that is fine.
- No invented figures, dates, thresholds or legal claims. Pricing copy points at
  the pricing page; legal copy points at the guide, which cites its sources.
- No deploys from a run. Vernon reviews and deploys the marketing container
  himself; runs leave files changed and print the git lines.
- Directory submissions, G2/Capterra claims and anything needing an account or an
  email address are **Vernon's own actions**. A run prepares the copy; it does
  not create accounts.

---

# Phase A — get into the cited corpus

Highest leverage, and mostly not code. A run can draft every word of it; Vernon
does the submitting.

## A1 — One canonical product fact sheet

Read: `marketing/index.html`, `docs/LOCARE_PRICING_DECISIONS.md`.

Write `marketing/internal/ai-fact-sheet.md`: the single source of truth every
directory profile and AI-facing page is filled from. Flat declarative statements,
one fact per line — what Locare is, who it is for, the country, the module list,
what it does not do, pricing entry point, company registration, support contact.
No marketing voice. Everything traceable to the product or the pricing doc.

This exists so that six directory profiles, written on six different days, do not
drift into six different descriptions of the product. Inconsistent facts across
sources are what make a model hedge or omit a vendor.

- [ ] Done

## A2 — Claim and check what already exists

Vernon's action; the run only prepares the checklist.

Resolve the `g2.com/products/locare/discuss` URL — is it Locare, a name
collision, or an auto-generated stub? Same for the `freedom251` listing. An
unclaimed or wrong third-party page about Locare is worse than no page: it is
exactly the kind of thin source a model will quote.

Produce `marketing/internal/ai-listings.md`: a table of every directory worth a
profile (Capterra co.za, GetApp, SoftwareAdvice, SoftwareSuggest, G2, plus any SA
proptech directory found), with claim URL, what it costs, what it demands, and
status. Vernon ticks as he goes.

- [ ] Done

## A3 — Directory profile copy, written once, reused

Read: `marketing/internal/ai-fact-sheet.md`.

Draft the profile copy for the top four directories from A2's table — short
description, long description, module/feature list, category selections,
pricing fields — into `marketing/internal/ai-listings-copy.md`, each clearly
headed by the directory it is for. Written from A1 only, so the facts match.

No reviews, no ratings, no customer counts. Where a directory demands a customer
count or a founded-year it does not have, say so in the file rather than filling
it with a guess.

- [ ] Done

---

# Phase B — make the site answerable

The site is already crawlable. These are the specific gaps that stop a model
from being able to answer a question *about* Locare without inventing something.

## B1 — The comparison and alternatives gap

Read: `marketing/guides/index.html` (shape only), `marketing/internal/ai-fact-sheet.md`.

There is no page that honestly compares Locare to the alternatives an agency
principal actually weighs — spreadsheets and WhatsApp, the incumbent SA
platforms, and doing it in an accounting package. "X vs Y" and "alternatives to
X" are among the highest-intent AI prompts there are, and right now every answer
to them comes from a competitor's or an aggregator's framing.

One new page, `marketing/compare.html`, same furniture as the guides. Factual and
checkable: what Locare does, what it does not, who each alternative suits better.
Name competitors only where the claim is verifiable from their own public pages,
and cite them. An honest comparison that concedes ground is more citable than a
puff piece, and far less likely to earn a correction.

- [ ] Done

## B2 — Pricing and "what is it" in extractable form

Read: `marketing/index.html`, `docs/LOCARE_PRICING_DECISIONS.md`.

The homepage carries `Offer` and `UnitPriceSpecification` JSON-LD but the plain-
language answers are spread through marketing prose. Add a short, visible,
plainly-worded block answering the five questions a model needs to describe
Locare: what it is, who it is for, what it costs to start, what it replaces, and
where it operates. Extend the existing `FAQPage` to match, keeping the markup and
the visible copy identical — divergence is a manual-action risk, as the comment
in `index.html` already notes.

- [ ] Done

## B3 — JSON-LD coverage for the four bare pages

Read: the four files named below.

`privacy.html`, `terms.html`, `tools/index.html` and `guides/index.html` carry no
JSON-LD. The two index pages are the ones that matter: `CollectionPage` with an
`ItemList` of the guides and of the calculators, so the set is machine-readable
as a set rather than ten unrelated articles. Keep each `Article` and
`WebApplication` entry consistent with the page it points at.

Also add `/llms.txt` — a short index of the guides, tools and fact sheet. Five
minutes, probably does nothing (see the evidence note above), harmless.

- [ ] Done

## B4 — Author and expertise signals

Read: `marketing/guides/*.html` (head blocks only), `marketing/internal/ai-fact-sheet.md`.

The guides are the strongest asset on the site and they are anonymous. Add a real
`author` to each `Article` node and a `Person` node for Vernon with his actual
credentials, plus `publisher` pointing at the existing `#org` node. Guides cite
legislation; a named author and a dated `dateModified` are what let a model treat
them as a source rather than as copy.

Do not invent credentials. If the honest answer is "founder of Locare", that is
what it says.

- [ ] Done

---

# Phase C — measure, then decide

## C1 — A baseline worth repeating

Read: nothing new.

Write `marketing/internal/ai-visibility-baseline.md`: fifteen fixed prompts an SA
agency principal would plausibly ask, from "best property management software
South Africa" through "software for PPRA trust accounting" to "alternatives to
<incumbent>". Record today's answer from each assistant Vernon can reach, noting
whether Locare is named and whether the description is correct.

Fifteen prompts, re-run monthly by hand, beats any dashboard here. The point is
to catch two things: Locare appearing, and Locare being described wrongly. The
second is the real risk once the directory profiles land.

- [ ] Done

---

## Open questions for Vernon

- Is the G2 "locare" page ours? Everything in A2 depends on the answer.
- Capterra and G2 both push paid placement. Is there a budget, or is this
  free-tier only? Changes which directories are worth A3's effort.
- The guides are the citable asset and the backlog is the engine behind them.
  Worth deciding whether `LOCARE_GUIDE_BACKLOG.md` should start favouring the
  comparison and "how do I choose" topics that AI assistants get asked, over
  pure compliance explainers.

---

## Log

One line per run: date, item, what landed, anything left.


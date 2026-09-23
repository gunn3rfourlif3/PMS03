# Locare Listing Plugin — Design Doc

Status: draft for review · Owner: Vernon · Touches: `listings`, `properties`,
`hosts`, `api-keys`, `web-admin/app/rentals`

## 1. Summary

An agency with its own domain and a website that already advertises vacancies
should be able to keep that website and still run everything through Locare.
They install a plugin, point it at their agency, and from then on **Locare is
the system of record for a vacancy and their site is a renderer**.

The rule this is built around:

> **One listing has one home.** A vacancy is captured once, in Locare, and
> appears on exactly one public surface. Locare never competes with its own
> customer for the same search result.

That is not a slogan — §4 makes it a setting the platform enforces, and §5 makes
it true at onboarding rather than after a month of double-capture.

What this is *not*: a website builder, a replacement for their site, or a reason
to touch their domain. Their web presence survives the onboarding untouched
except for one plugin and one page.

## 2. Why this matters commercially

Every agency worth selling to already has a website. Today the only answer
Locare has for them is "we'll serve `rentals.youragency.co.za` as well", which
asks them to run two websites competing for the same searches and to maintain
vacancies in two places. That is a worse position than they are in now, and a
principal will spot it in the first meeting.

It is also the difference between a sales conversation about accounting — where
Locare is strong — and one about websites, where the agency has already spent
money and has a web person with an opinion.

## 3. What exists today

Better than expected. The read path and the apply path are both already public.

- **`GET /listings/public?vendor=<key>`** — unauthenticated browse. `p_key`
  matches **either `vendors.slug` or `vendors.custom_domain`**, so an agency
  key is a value they already own.
- **`GET /listings/public/:id`** — unauthenticated detail.
- Both run through `SECURITY DEFINER` functions (`public_listings`,
  `public_listing`, migration `1720000018000-PublicListings`) that bypass RLS
  deliberately and filter to `status = 'published'` and `v.status = 'active'`.
- **`POST /listings/applications`** — unauthenticated, takes
  `{ listingId, applicantName, applicantEmail, applicantPhone?, details? }`,
  and already enforces an 18+ age gate from DOB or a 13-digit SA ID.
- `web-admin` renders `/rentals` (browse) and `/l/[id]` (detail) from the same
  data — useful as the reference implementation of a listing page.

**Correction to an earlier read of mine:** the apply endpoint is *not*
unthrottled. `app.module.ts` registers `ThrottlerModule.forRoot([{ ttl: 60000,
limit: 120 }])` with `ThrottlerGuard` as an `APP_GUARD`, so every route
including this one gets 120 requests per minute per IP. That is a global
default, not a considered limit for a public write endpoint — see §9.

What does **not** exist:

- Any outbound webhook infrastructure. Every `webhook` in the codebase is
  inbound (DebiCheck consent, e-sign callbacks, payment notifications). There
  is no mechanism for Locare to notify an external site of anything.
- Any portal syndication — no Property24, Private Property, Entegral/Flex, and
  no feed export of any kind (§12).
- Any per-agency control over which public surface serves listings (§4).

## 4. The surface switch

The no-duplicates rule needs to be enforced by configuration, not by everyone
remembering. Add to the vendor:

```
listing_surface  text not null default 'locare_hosted'
                 -- locare_hosted | external_site | dual
```

| Value | `rentals.<domain>` serves | Canonical URL |
|---|---|---|
| `locare_hosted` | The listings (today's behaviour) | Itself |
| `external_site` | A 301 to their site's listings page | Their site |
| `dual` | The listings | **Their site** |

`dual` exists only for the migration window — the week where their site is
being switched over and both are live. It is not a supported end state, and
the admin UI should say so where it is set.

`vendors.config` is a `jsonb` column that could hold this without a migration.
Do not use it for this. A field that decides what a public host serves deserves
to be a real column with a constraint, findable by anyone reading the schema.

**The canonical tag is the part that actually protects them.** Two pages with
the same listing text, no canonical, is a duplicate-content problem that hurts
the agency, not Locare, and they will not know why.

## 5. Onboarding: claim, then import

This is the step that makes the rule true. If an agency has to re-type forty
existing listings into Locare, the double-capture they were objecting to has
simply been moved to week one.

So the plugin's first run is a **claim**, not a sync:

1. **Read what is already there.** The plugin enumerates their existing listing
   posts — title, body, price, photos, permalink.
2. **Match against Locare units.** They have no unit IDs, so matching is fuzzy:
   property name and address first, then unit label, then bedroom count and
   rent as tie-breakers.
3. **Review, do not guess.** A screen showing proposed matches, unmatched
   listings, and unmatched Locare units, with the ability to correct each one.
   This is exactly the import module's dry-run-then-commit shape (`sheet` →
   `mapping` → `check` → `commit` / `discard`) and should reuse it rather than
   inventing a second mechanism with different failure behaviour.
4. **Pull content across.** Description and photos move into Locare, so nothing
   is lost and Locare becomes genuinely authoritative.
5. **Record the old permalink** against the listing. §10 needs it.
6. **Only then** flip `listing_surface` and let the plugin take over the page.

An agency that abandons the wizard half-way must be left exactly as it started.
No partial claim.

## 6. What the plugin needs that the API does not yet return

The existing payload is close but not sufficient. `public_listings` returns:

```
id, rent, availableFrom, description, media,
unitLabel, bedrooms, bathrooms, propertyName, address, propertyType
```

Gaps, each of which forces the plugin to do something worse:

| Missing | Consequence |
|---|---|
| `updatedAt` | A polling plugin cannot tell what changed. It must diff every listing on every run, or rewrite posts that did not change — which churns their site's modified dates and confuses their sitemap. |
| `slug` | URLs are UUIDs. `/rentals/2-bed-northcliff-mews` is not possible, and a UUID in a URL is a ranking and shareability handicap. |
| `status` | The plugin can detect a listing's *absence* but not distinguish let from paused from deleted, so it cannot choose between 301 and 410 (§10). |
| `sizeSqm`, `deposit`, `adminFee` | All three exist on the entities and are exactly what an applicant filters on and asks about. |
| Pagination | One `json_agg` of every published listing. Fine at 40, not at 500. |
| `media` / `address` shape | Both are raw `jsonb` with no documented contract. A third-party plugin cannot code against "unknown[]". |

Also worth deciding: `public_listing(p_id)` takes an id with **no vendor
scoping**, so any published listing on the platform can be fetched by id from
any site. These are public records, so it is not a leak — but the plugin should
pass its vendor key and have the function verify the listing belongs to it, or
a misconfigured site will happily render another agency's flat.

Versioning: this becomes a contract with software installed on machines we do
not control. It belongs under `/v1` alongside the existing external API, and it
does not change shape afterwards without a `/v2`.

## 7. The WordPress plugin

Most small South African agency sites are WordPress. That is the integration
that turns a project into an install.

### 7.1 Sync into real posts, not virtual routes

Two approaches, and the less clever one wins:

**Sync into posts (recommended).** The plugin registers a custom post type and
creates or updates genuine WordPress posts from Locare. Their theme renders
them. Their SEO plugin sees them. Their sitemap includes them. Their site
search finds them. Everything already installed on that site keeps working
without knowing Locare exists. The cost is that it is a cache and needs
refreshing (§8).

**Virtual routes.** The plugin intercepts a URL pattern and renders from the
API at request time. Always fresh, but it fights every SEO plugin, every page
cache, and every CDN they have, and their theme cannot style it.

The second is a support burden on somebody else's hosting. Choose the first.

### 7.2 Components

- **Settings screen** — agency key (their slug or custom domain) and nothing
  else if possible. A connection test that reports how many published listings
  it can see.
- **Claim wizard** (§5), run once.
- **Cron sync** (§8).
- **Block and shortcode** for a listings grid, so they can place it on any page
  without a developer.
- **Template overrides** — `locare/listing-card.php`, `locare/listing-single.php`
  resolvable from their theme, so their web person can restyle without forking
  the plugin. This is what makes that person an ally instead of an objector.
- **Media handling** — sideload photos into their WP media library rather than
  hot-linking Locare. Their site should not go blank if Locare has a bad day,
  and their existing image optimisation should apply.

## 8. Freshness, and the let-unit path

With no outbound webhooks (§3), v1 is **polling**: WP-Cron every 10–15 minutes.
That needs nothing new on the Locare side, works behind any firewall, and is
honestly fine at this scale. Webhooks are a later optimisation.

The case that has to be reliable is a unit being let, because it is the promise
that sells the integration:

> Your website stops advertising flats you have already let.

When a lease is signed, the listing moves out of `published` and disappears
from `public_listings`. The plugin sees its absence and unpublishes the post.
Two requirements fall out:

- The sync must distinguish "gone from the feed" from "the API call failed".
  A failed fetch must never unpublish anything. Unpublish only on a successful
  response that omits the listing.
- `public_listing(:id)` currently throws a bare 404 once a listing closes. For
  a URL that has been indexed and shared, a 404 is the worst answer. §10.

## 9. Applications from somebody else's website

The apply form will render inside the plugin and post to Locare. The moment a
public write endpoint is called from third-party sites with a publicly known
agency key, it is an abuse surface.

The global throttle is 120 requests per minute per IP, which is a framework
default rather than a decision about this route. By comparison, the partner
application flow drops its entry point to 5 per minute. Before this is
publicised:

- A route-level `@Throttle` on `POST /listings/applications`, in the range the
  partner routes use, not 120.
- A per-vendor cap as well as per-IP — a distributed flood aimed at one agency's
  applicant queue does not trip a per-IP limit.
- A honeypot field in the plugin's form, which costs nothing and stops the
  overwhelming majority of bot submissions.
- CORS: the endpoint should accept the agency's own origin, which we know from
  `custom_domain`, rather than `*`.
- The 18+ age gate already in `applications.service.ts` stays as the last word.
  It is a business rule, not a form validation, and it belongs on the server.

We do not solve CAPTCHAs and we should not add one that punishes a genuine
applicant on a phone.

## 10. SEO rules

This whole design exists so the agency keeps the ranking they already paid for.
That is fragile and worth writing down.

- **Server-rendered.** Rendering into real posts (§7.1) gives this for free.
- **Their permalink structure is preserved where possible.** Where it cannot
  be, the claim step recorded the old URL (§5.5) and the plugin issues a 301
  from it. Never leave a previously-indexed URL returning nothing.
- **A let listing is a 301 to the browse page**, or a 410 if it should leave
  the index entirely. Never a soft 404, and never a page that says "not found"
  while returning 200.
- **One canonical, always.** Per §4, in `dual` mode that is their domain.
- **Structured data** — `schema.org` markup on each listing page. It is cheap
  and it is how listings get rich results.
- **Their sitemap keeps working** because the posts are real posts.
- The plugin should not rewrite a post whose content has not changed, or every
  sync churns `lastmod` across their whole site.

## 11. Sites that are not WordPress

A minority, but not zero, and they are often the bigger agencies.

- The `/v1` listings endpoints, documented properly, with the payload contract
  from §6 settled.
- A small JS embed for a grid — the honest fallback, with the SEO caveat stated
  plainly rather than glossed. It is for an agency who wants vacancies on a page
  quickly and does not care about ranking that page.
- Worked examples. A developer who can see a real request and a real response
  integrates in an afternoon.

## 12. The obligation this inherits

Making Locare the system of record means Locare becomes responsible for
**everywhere those listings currently appear** — not only their website.

If the agency feeds Property24 or Private Property today, and Locare takes over
as source of truth without feeding those portals, the duplication has not been
removed. It has moved somewhere worse, and it now costs them leads from the
channel that actually produces their applicants.

So the discovery question before any of this is sold is not about their website:

> **Where do your enquiries actually come from?**

If the answer is the portals, then portal syndication is the gate, and the
plugin is phase two. If the answer is their own site and walk-ins, the plugin
is the whole job. There is no way to know without asking, and guessing wrong
means building the right thing for the wrong agency.

## 13. Phasing

| Phase | Ships | Gate |
|---|---|---|
| 1 | `/v1` listings contract per §6, route throttle + honeypot + CORS per §9, proper gone-status handling per §10 | None — all of it is worth having regardless |
| 2 | `listing_surface` column, canonical behaviour, `rentals.` redirect | Phase 1 |
| 3 | WordPress plugin: settings, cron sync, block/shortcode, template overrides | Phase 2 |
| 4 | Claim-and-import wizard | Phase 3, and a real agency site to test against |
| 5 | Documented REST path and JS embed for non-WordPress | Demand |
| 6 | Portal syndication | §12 |

Phases 1 and 2 are useful even if the plugin is never built — they fix a public
API and close a duplicate-content hole. That is the right kind of first phase.

Migrations continue from `1720000053000-AdminGrantConflicts`. Note that the
service-directory design (`LOCARE_SERVICE_DIRECTORY_DESIGN.md`) also proposes
the next two numbers; whichever is built first takes them.

## 14. Open questions

1. **Does the plugin own the listing page, or a listings section?** Owning a
   page under their nav is a much easier ask than owning their URL structure,
   and most agencies will accept `/rentals` even if their current listings live
   elsewhere. Worth deciding before the claim wizard is designed, because it
   changes how much of §10 is needed.
2. **What happens when they edit a listing in WordPress?** The rule says Locare
   is the source of truth, so the honest answer is that their edit is overwritten
   on the next sync. Better to make the synced posts read-only in the WP editor
   with a "edit this in Locare" link than to let someone lose work silently.
3. **Do we distribute through the WordPress plugin directory?** It brings
   discovery and free credibility, and it brings a review process, a support
   forum, and a public one-star rating. Probably worth it eventually, but not
   for the first agency.
4. **Who installs it?** An agency principal will not FTP a plugin. Either the
   Locare onboarding operator does it with credentials the agency supplies —
   which is access we then have to think carefully about holding — or their web
   person does it from a written guide. The second is safer and slower.
5. **What does the plugin do when the agency's subscription lapses?** It should
   fail visible-but-harmless: stop syncing, leave the existing posts up, and
   warn in the admin. A plugin that blanks an agency's website over a billing
   dispute is a story that ends up on a forum.
6. **Is `slug` per listing or per unit?** A unit relet three times should
   arguably keep its URL and its accumulated ranking rather than minting a new
   one each vacancy. That argues for the slug living on the unit, not the
   listing — which is a schema decision worth making before phase 1 ships.

# Locare — guide companion videos

Status: design, not built. Written 2026-08-27. Owner: Arthur.

Every published guide gets a 3–4 minute narrated companion video, embedded on
its own page and posted to YouTube. Reuses `scripts/video/`.

---

## 1. What this is, and what it deliberately is not

**It is a by-product of the guides, not a content calendar.** The cadence is
whatever the guide pipeline produces — roughly fortnightly, sometimes not. There
is no obligation to ship a video in a week with nothing to say, because a video
with nothing to say is worse than silence on a channel nobody has subscribed to
yet.

**It is not a channel-growth play.** Locare has one customer and no subscribers.
Measuring this on views for the first year would be measuring the wrong thing
and would tempt the pipeline toward volume. What it is actually for:

- **On-page video.** A guide with a video on it holds attention longer and gives
  Google a second thing to index for the same research. This is the main reason
  to do it at all.
- **Something to send.** A prospect who asks "what's this trust reconciliation
  thing you mentioned" gets a link rather than a paragraph.
- **Partner enablement later.** Curriculum Module 5 gates promotion on demos.
  Videos make the preparation for that cheaper.

**It never publishes by itself.** See §5.

## 2. The format problem, and the answer

The existing pipeline records *the product*. A guide about the PPRA's section 54
has no product footage — filming the back-office over a narration about
fidelity fund certificates would be a mismatch, and the kind that makes a viewer
distrust both halves.

**So the guide video is a narrated slide film, not a screen recording.**

Built from the same brand card HTML already used for the video intro and outro
(`docs/video/brand-cards.html`), rendered by the same Playwright recorder. One
card per section of the guide: a heading, at most two lines of supporting text,
brand colours, generous whitespace. The narration carries the content; the
cards keep the eye occupied and make the structure legible.

Three exceptions, where product footage genuinely belongs and should be spliced
in from a normal `beats.config.mjs` run:

| Guide topic | Product beat worth showing |
|---|---|
| Trust reconciliation, audits | The ledger view, and an owner statement |
| Deposits and interest | The deposit trust flow, and the calculator |
| Rent collection, arrears | The rent run and the arrears queue |

The rule: **footage only where it illustrates the sentence being spoken.**
Filler b-roll of an unrelated screen is what makes product videos feel like
adverts.

## 3. How a script is derived from a guide

The guide is already researched, verified and legally reviewed for language. The
script must not reopen any of that.

**The generator's only job is compression, not authorship.** It takes the guide's
headings and lede, and writes narration that says less than the guide does —
never more. Specifically:

- Every factual claim in the script must appear in the guide. No new statistics,
  no new legal assertions, no rounding a "roughly" into a number.
- The guide's caveats travel with it. If the guide says "confirm with your
  auditor", the video says it too, out loud, not as a caption nobody reads.
- Nothing from curriculum Module 8's never-say list: no "PPRA compliant", no
  "no audit needed", no invented customers, no competitor claims.
- Locare appears once, at the end, for about fifteen seconds. A four-minute
  video that is three minutes of genuine help and one sentence of product earns
  the sentence.

Narration follows the house rules already in `narration.json`: short clauses, no
em-dashes, en-ZA phrasing, and the `_pronounce` map — **`Locare` is
loh-KAH-reh**, which every TTS engine gets wrong unprompted.

Spoken length sets beat duration, as it already does, so a video is retimed by
rewriting sentences rather than editing numbers.

## 4. What the agent produces

One folder per guide, staged for review:

```
docs/video/guides/<guide-slug>/
  script.json        narration, one line per card — the thing to review first
  cards.html         the rendered slides
  out/<slug>.mp4     finished 1080p cut
  out/<slug>-9x16.mp4  vertical crop for Shorts
  thumbnail.png
  metadata.md        title, description, tags, the guide URL, the embed snippet
  REVIEW.md          what to check before publishing (see §5)
```

Nothing is uploaded. Nothing is added to the guide page. Both are one manual
step each, and both are deliberate.

## 5. The review gate, and why it is not negotiable

The weekly guide agent drafts and never publishes. That judgement carries over,
and applies harder here.

A wrong claim in a video is worse than a wrong claim on a web page in three
specific ways: it is harder to correct quietly, it carries a voice and therefore
more apparent authority, and on YouTube it can be re-uploaded by anyone before
you notice. A guide page can be fixed in a commit; a video that says Locare
makes an agency PPRA compliant is a problem that outlives its correction.

`REVIEW.md` is generated with the video and asks for four things:

- [ ] Every claim in the narration appears in the source guide
- [ ] The guide's caveats are spoken, not just captioned
- [ ] Nothing from Module 8's never-say list
- [ ] `Locare` is pronounced loh-KAH-reh throughout

The last one sounds trivial and is not. It is the single most likely defect,
it is audible to every viewer, and it undermines the brand in the first sentence.

## 6. Publishing

**YouTube upload is blocked and will stay blocked for now.** The Data API needs
Google OAuth, and Locare's brand verification is still unapproved — it is on the
outstanding list in `CLAUDE.md`. Uploading by hand takes two minutes and there is
no volume to justify automating it before the verification lands.

When it does land, automate the *upload as unlisted*, never as public. That way
the agent can do the tedious part and publishing stays a decision.

**Embedding on the guide page** is a small edit: a `<video>` or a privacy-mode
YouTube iframe (`youtube-nocookie.com`) above the first heading. Prefer
self-hosted MP4 if the file is small enough — it avoids a third-party cookie
question on a site whose privacy policy Locare has just spent effort getting
right.

## 7. Build order

1. **One video by hand, end to end**, from the PPRA trust accounts guide. Nothing
   is automated until the format is proven watchable — that is a judgement no
   pipeline can make for you.
2. **Card renderer**, driven by a `script.json`, reusing the recorder.
3. **Script generator** from a guide's HTML, with the §3 constraints.
4. **`REVIEW.md` generator** and the folder layout in §4.
5. **Scheduled agent**, mirroring `locare-weekly-guide`: runs after a guide is
   published, stages the folder, notifies, stops.

Steps 1–2 are the ones that decide whether this is worth doing. If the hand-made
first video is dull, the honest answer is to stop and keep the guides as text.

## 8. The thing to weigh against

This competes for hours with the money path — no live payment has been processed
— and with DebiCheck, which is blocked on a bureau that has not replied since
19 August.

Building it as a by-product of work already being done is defensible. Building
it as a project with a fortnightly commitment attached is how the load-bearing
things get deferred while something more enjoyable feels like progress.

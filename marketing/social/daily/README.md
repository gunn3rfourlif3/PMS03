# Daily social creative

One 1080x1350 (4:5) post per day, rendered from `calendar.json`. A scheduled
task runs this every evening at 20:00 SAST so the next morning's post is ready.

```bash
node render.mjs            # the next unpublished day, advances state.json
node render.mjs --day 7    # one specific day, leaves state alone
node render.mjs --all      # the whole set, as a proof sheet
```

Outputs land in `out/` as `locare-daily-NN-<id>.png` and a matching `.md` with
the post copy, the hashtags, and the line of the product each claim rests on.

## How it is split

`calendar.json` is the content. `render.mjs` is only the typography. Every word
a post says lives in the JSON, so changing a claim never means reading
JavaScript, and anyone can audit a month of marketing copy in one file.

Each entry carries a `source` field naming the route or table the claim rests
on. If a feature is ever removed, grep `source` for it and the affected posts
are the ones to rewrite. That field is the difference between a content
calendar and a list of things we hope are true.

## Layouts

Four skins, assigned per entry, so a month of posts is recognisably one brand
without being the same picture thirty times:

| `layout` | Looks like | Device |
|---|---|---|
| `ledger` | Deep blue, glass card | A table — ledger extract, aged arrears, statement |
| `panel` | Light | A browser chrome + page card, in an example agency's colour |
| `flow` | Near-black | A vertical rail of steps with values |
| `statement` | Mid brand blue | A pull-quote plus three ticked points |

## Things that will bite

- **The headline size is computed, not chosen.** Line length sets a candidate
  size and the layout caps it (`CAP` in `render.mjs`), because a four-step flow
  leaves far less vertical room than a table. Rewriting a headline longer will
  reflow it, which is the intent.
- **`render.mjs` throws when a layout overflows 1350px** rather than shipping a
  creative with its footer cropped. At 20:00 nobody is looking, so a loud
  failure beats a quiet bad image. The fix is almost always a shorter `body` or
  one fewer device row.
- **Fonts are `font-display:block` and the render awaits `document.fonts.ready`.**
  Screenshotting early ships a creative in a fallback face that looks almost
  right. `ASSETS` looks for `fonts/` beside the script first, then one level up,
  because the scheduled run stages everything flat.
- **Every figure in every creative is illustrative** and the creatives say so on
  their face. No real agency, owner, tenant or unit appears anywhere in the set.
- **No customer counts, testimonials or logo walls.** One agency is live and
  there are no paying customers, so there is nothing true to put there yet.

## Why `out/*.png` is not committed

The images are fully reproducible from `calendar.json` + `render.mjs`, and a
1.5MB PNG a day is half a gigabyte of git history a year. The `.md` files are
committed — they are the actual record of what was published and when, and they
are two kilobytes. If you need day 12's image back, `node render.mjs --day 12`.

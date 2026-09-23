# Channel / social artwork

Source for the YouTube channel banner. Regenerate rather than edit the PNGs:

```bash
cd marketing/social
npm install playwright @fontsource/plus-jakarta-sans
cp node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2 fonts/pjs-400.woff2
cp node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2 fonts/pjs-600.woff2
cp node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2 fonts/pjs-800.woff2
node shoot.mjs a b
```

`locare-banner-a.png` — deep brand blue, white knockout wordmark.
`locare-banner-b.png` — light, keeps the two-tone logo (blue `l`, `#121212` wordmark).

## The dimensions are not negotiable

2560 x 1440 is the upload size. YouTube then crops it differently per device,
and only the **centre 1546 x 423** survives everywhere, phone included. That
rectangle is `.safe` in the HTML, absolutely positioned, and nothing that has to
be read may sit outside it. Desktop shows 2560 x 423; a TV shows the whole
2560 x 1440, which is why the background carries the rounded-square motif out
to the edges instead of stopping at the safe area.

Keep the file under 6 MB (YouTube's limit). Both cuts land around 3.5 MB.

## Notes for whoever changes this next

- The wordmark is copied from `marketing/brand/locare-logo.svg`. It carries
  **two** fills, `#2D6A8F` for the `l` and `#121212` for `ocare`, so a white
  knockout has to replace both. `wordmark-white.svg` is that, pre-made:

      sed -e 's/#2D6A8F/#FFFFFF/g' -e 's/#121212/#FFFFFF/g' wordmark-brand.svg

- Fonts are Plus Jakarta Sans, the same family as the admin console. They load
  with `font-display:block` and `shoot.mjs` awaits `document.fonts.ready`,
  because screenshotting early silently ships a banner set in a fallback face
  that looks almost right.
- The rounded-square motif echoes the mark's tile silhouette (`rx/size = 112/512`).
- Both cuts carry a faint grain layer. A 2560px gradient banded in 8-bit PNG
  looks cheap without it.
- The light cut masks its motif with a luminance ramp (black -> white). An SVG
  mask keys off luminance, not alpha: a black gradient with varying alpha is
  black throughout, so it hides everything and the motif vanishes.
- This folder is deliberately NOT under `marketing/brand/`, which `marketing/Dockerfile`
  copies into the served image. Channel artwork does not need to be public.

## Paid social creatives

`ad-a-ledger.html`, `ad-b-whitelabel.html`, `ad-c-monthend.html` — three 4:5
(1080 x 1350) concepts for Facebook, Instagram and LinkedIn. Post copy and how
to run them: `ads-copy.md`.

```bash
cd marketing/social
node shoot-ads.mjs            # all three
node shoot-ads.mjs ad-a-ledger.html
```

- 1080 x 1350 is the tallest in-feed format Meta allows, so it takes the most
  phone screen. There is no safe-area rule here as there is for the channel
  banner — the whole canvas is shown.
- `shoot-ads.mjs` warns when a layout overflows 1350px instead of silently
  screenshotting a creative with its footer cropped off. Heed it: the headline
  sizes are tuned to the exact strings, and rewriting a headline longer will
  reflow it.
- The ledger extract in cut A is real double-entry (rent receipt, then
  commission) and the columns foot to the same number. An agency principal reads
  that the way a designer reads kerning, so check it still balances if the
  figures ever change.
- Every amount across all three is the same illustrative 12 500 / 1 000 /
  11 500, so the set reads as one campaign. No real agency, owner, tenant or
  unit appears, and each creative says on its face that the figures are
  examples.
- No customer counts, testimonials or logo walls: one agency is live and there
  are no paying customers, so there is nothing true to put there yet.

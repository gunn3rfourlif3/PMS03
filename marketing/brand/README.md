# Brand assets served at /brand

`marketing/Dockerfile` copies this whole folder to `/srv/brand`, so anything
added here is public at `https://locare.co.za/brand/<file>` on the next deploy.
No Dockerfile change needed.

## locare-bimi.svg

The BIMI logo, referenced by the `default._bimi.locare.co.za` TXT record.

Generated from `locare-mark-512-brand.svg` — the **mark**, not the wordmark.
BIMI renders at avatar size, around 32px, where a wordmark inside a 512 box is
illegible. If the mark changes, regenerate this from the new one rather than
editing it by hand.

It is deliberately a different file from the mark it came from, because BIMI
requires **SVG Tiny Portable/Secure**, which ordinary exports do not satisfy:

- `version="1.2"` and `baseProfile="tiny-ps"` on the root
- `<title>` as the first child
- no scripts, no animation, no external references, no `<image>`
- no `role` or `aria-*` — those are ARIA, not SVG Tiny, and validators reject them
- under 32 KB

**It will not display anywhere yet.** Gmail and Apple Mail only render a BIMI
logo when the record also carries a Verified Mark Certificate (`a=`), and a VMC
requires a *registered trademark*. Locare (Pty) Ltd is a CIPC company
registration, which is not a trademark — SA registration runs 18–24 months and
the certificate is roughly $1,000/year. The record is correct and dormant: when
a trademark exists, add `a=` and it starts working with no other change.

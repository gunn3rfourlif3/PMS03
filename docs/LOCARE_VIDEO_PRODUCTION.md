# Locare — video production pack

One shoot, three cuts. Concept: **month-end in sixty seconds**, with a white-label
beat in the middle. Everything is real product footage topped and tailed with
animated brand cards (`docs/video/brand-cards.html`).

Built caption-first: the video must land with the sound off. Voiceover is
optional and additive, never load-bearing.

---

## 0. Before you record anything — demo data

**Do not film Dantalan's live data.** Real tenant names, ID numbers, phone
numbers and banking details would put personal information into a public
marketing asset. Publishing a POPIA breach in a promo for POPIA-aligned software
is not a recoverable look.

Set up a throwaway agency first:

1. Create a demo vendor — suggested name **Ridgeline Property** (invented, no
   real agency of that name in SA at time of writing; check before publishing).
2. Seed fictional tenants. Suggested: *Naledi Mokoena*, *Riaan de Villiers*,
   *Thandiwe Nkosi*. Use `+27 82 000 0001`-style numbers and `@example.com`
   addresses.
3. Bank details: use obviously fake account numbers (`0000 0000 000`).
4. Log in as a demo admin, not your platform-admin account — the impersonation
   banner must not appear on camera.
5. Before each take, check the browser: no other tabs with real data visible, no
   bookmarks bar, no notification popups, no email preview.

Second pass before publishing: watch the finished cut at full screen and pause
on every frame showing a list. Names leak in table rows more often than you expect.

---

## 1. Capture settings

| Setting | Value |
|---|---|
| Resolution | 1920×1080, record at 100% browser zoom |
| Frame rate | 60fps (smooth cursor and transitions; downscale later if needed) |
| Browser | Chrome in a clean profile, no extensions, bookmarks bar hidden (Ctrl+Shift+B) |
| Window | Full screen (F11) — no tab strip, no URL bar, no OS chrome |
| Cursor | Enable click highlighting in OBS/ScreenPal so taps read on small screens |
| Mobile shots | Real phone, screen-recorded, or Chrome DevTools device mode at iPhone 14 Pro |
| Tools | OBS Studio (free) to capture; CapCut or DaVinci Resolve (free) to edit |

Move the mouse **slowly and deliberately**. The single biggest tell of amateur
product video is a cursor that darts. Pause ~1s on each screen before clicking.

---

## 2. Master script — 90 seconds

Timecodes are for the 90s sales cut. Captions are what appears on screen; keep
them to one line where possible, set large, bottom-third, high contrast.

### Beat 1 — the hook (0:00–0:06)

| Shot | On screen | Caption |
|---|---|---|
| Animated title card (`brand-cards.html`, intro) | Locare wordmark resolves | — |
| Cut to a spreadsheet of rent tracking, scroll it | Messy sheet, merged cells | **Month-end shouldn't take three days.** |

*Optional VO:* "If your rent roll lives in a spreadsheet, month-end owns your week."

### Beat 2 — the rent run (0:06–0:20)

| Shot | Click path | Caption |
|---|---|---|
| Back-office dashboard | Land on `/` — let the bento tiles render | **One place for the whole portfolio.** |
| Leases list | Sidebar → **Leases** | — |
| Trigger the rent run | Show invoices generated for the period | **Invoices raise themselves. Every unit, every month.** |
| Payments page | Sidebar → **Payments** — invoices listed as unpaid | — |

### Beat 3 — the tenant pays (0:20–0:32)

| Shot | Click path | Caption |
|---|---|---|
| Phone: tenant app home | Tenant app → home, rent due card visible | **Your tenant pays from their phone.** |
| Phone: pay flow | Tap pay → gateway → success | — |
| Phone: confirmation | Receipt shown | **In their language, under your brand.** |

Shoot the phone footage separately and cut it in as a floating device frame over
a blurred back-office background — it reads as "meanwhile, elsewhere".

### Beat 4 — reconciliation (0:32–0:44) — *the money shot*

| Shot | Click path | Caption |
|---|---|---|
| Back-office Payments, refresh | Payment appears, status flips to matched | **It reconciles itself.** |
| Open the ledger view | Show the double-entry postings | **Proper double-entry. Not a spreadsheet with ambition.** |

This is the beat that separates you from every competitor. Hold on the ledger
2–3 seconds longer than feels comfortable.

### Beat 5 — brand flip (0:44–0:54)

| Shot | How | Caption |
|---|---|---|
| Same screen, three identities | Cut between the same dashboard under three different agency brandings — logo, colour, domain in the URL bar | **Your brand. Your domain.** |
| Rentals site under agency brand | Show the branded listings site | **Your tenants never see ours.** |

Produce this by changing the demo agency's branding between takes, framing the
shot identically each time so only the brand changes. Cut on the beat — roughly
0.8s per identity.

### Beat 6 — owner statement and payout (0:54–1:12)

| Shot | Click path | Caption |
|---|---|---|
| Owner statements | Sidebar → **Owners** → statement | **Owner statements build themselves.** |
| Statement detail | Rent in, commission out, expenses, net | **Every cent accounted for.** |
| Payout split | Show the split payout | **Then it pays them.** |
| Owner portal on phone | Owner's live view | **Owners stop phoning you. They can just look.** |

### Beat 7 — the close (1:12–1:30)

| Shot | On screen | Caption |
|---|---|---|
| Quick montage, 0.6s each | Maintenance ticket → lease e-sign → reports | **Leasing. Maintenance. Documents. Trust accounting.** |
| Animated outro card | Locare wordmark + URL | **locare.co.za** |

*Optional VO close:* "Locare. Property management, beautifully run."

**Claims discipline:** no "trusted by", no customer counts, no invented
statistics, no testimonials. You have one agency live. Everything in this video
must be something the camera actually shows the product doing.

---

## 3. The three cuts

### 15–20s social cut — *publish this first*

The one you actually distribute: LinkedIn, WhatsApp, partner recruitment.

```
0:00–0:03   Hook — spreadsheet, caption "Month-end shouldn't take three days."
0:03–0:07   Rent run — invoices generate
0:07–0:12   Tenant pays on phone → reconciles itself  ← the whole story
0:12–0:16   Owner statement + payout
0:16–0:19   Outro card, locare.co.za
```

Cut hard, no dwelling. Square (1:1) or vertical (9:16) crop for feeds — frame the
original 16:9 capture with safe margins so you can crop without losing captions.

### 45s hero cut

Beats 1, 2, 4, 5, 7. Drop the tenant-phone detail and the owner portal. When you
eventually put this on the site, use a **click-to-play poster image, not
autoplay** — an autoplaying background video will undo the Lighthouse work
(currently 97, Speed Index 4.7s).

### 90s sales cut

The full master above. Send after demo requests and to partner applicants, where
the viewer is already warm and wants detail.

---

## 4. Music and voice

- Music: instrumental, restrained, ~90–110bpm. Free sources: YouTube Audio
  Library, Pixabay Music. Check the licence allows commercial use.
- Duck music under any VO by ~12dB.
- If you record VO: your own voice in a South African accent beats a synthetic
  American one for this market. Record into a phone under a duvet if you have no
  mic — it genuinely works.
- Captions are mandatory regardless. Burn them in; platform auto-captions are
  unreliable and mis-hear "Locare" every time.

---

## 5. Checklist

- [ ] Demo agency seeded with fictional data
- [ ] Logged in as demo admin, no impersonation banner
- [ ] Browser clean: full screen, no bookmarks, no notifications
- [ ] Intro/outro cards recorded from `docs/video/brand-cards.html`
- [ ] All seven beats captured, slow cursor, 1s pauses
- [ ] Three brand identities captured for the flip, identical framing
- [ ] Phone footage captured separately
- [ ] Captions burned in, readable at phone size
- [ ] Full-screen review pass for leaked personal information
- [ ] No unverifiable claims anywhere in the cut

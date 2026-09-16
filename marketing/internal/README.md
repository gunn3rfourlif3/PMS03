# marketing/internal

Customer-facing pages that are **not** part of the public site.

`marketing/Dockerfile` copies named files and directories only, and this folder
is not among them — so nothing here is served on locare.co.za. Adding a `COPY`
line for it would publish it; that is the only thing standing between these
pages and the open web, so think before adding one.

Each page also carries `<meta name="robots" content="noindex, nofollow">` as a
second line of defence, in case one is ever served by accident.

## Contents

- **what-locare-builds-next.html** — shown to agency owners to test four unbuilt
  ideas (arrears cases, inspection routing, load-shedding, the landlord view)
  before committing to any of them. The arrears half is specified in
  `docs/LOCARE_ARREARS_CASES_DESIGN.md`.

  There is also a published copy hosted on claude.ai, which is the link actually
  sent to people. Edit one and the other drifts — when this file changes,
  re-publish, and vice versa.

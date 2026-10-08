# Locare On-Site — Client Options

Oct 6, 2026. Prospect: Midnight Masquerade. The note taken to the client.
The demo built from it is `LOCARE_ONSITE_DEMO_BUILD_PLAN.md`.

**Yes, Locare can run on their own server.** It already installs on one machine,
and the staff back office works in full with no internet at all. The only real
question is whether people outside the building need to get in.

## Staff: easy. Tenants and landlords: not

Everything their own people do at their desks works on an internal server.
Anything an outsider must reach does not: card and instant-EFT rent,
e-signature, tenant and landlord logins, public listings, login codes to phones.
Those need one address published to the internet. That trade-off is the whole
decision.

## Three options

|  | Where the data sits | Who runs it | Tenant & landlord features | Their IT effort |
| --- | --- | --- | --- | --- |
| A - On-Site, Back Office | Their building, sealed off | Their IT | None. Bank-statement import, print and sign | Low |
| B - On-Site, Connected | Their building, one published address | Their IT | All of them | High |
| C - Private Server | Our data centre, their own database | Us | All of them | None |

A is the strict reading of "on our premises", and costs them tenant self-service.
B is the full product on their hardware, and needs real IT. C is worth offering
even unasked: it is often what a client means, and it answers "our data mixed
with other agencies'" without an on-site build.

## What they must supply (A and B)

A server (4 cores, 16 GB, 500 GB, Linux, always on). A way to send email.
Nightly backups kept off that machine, with one restore actually tested. A named
IT person. If they cannot tick all four, recommend C.

## Bring back seven answers

1. Why on-site? Policy, a regulator, or a preference - the real reason may be answered by C.
2. Do tenants and landlords need logins? The whole difference between A and B.
3. How do tenants pay rent today? If it is manual EFT already, A changes nothing for them.
4. Who is their IT - a department, a provider, or a relative?
5. Is there a server, or must one be bought?
6. How many users, properties and leases?
7. Who signs, and by when?

# Locare — Verifiable Tenancy Records and the Consortium Question

Status: **Exploratory.** Owner: Arthur. Written 2026-08-19.

Nothing here is decided. §7 is the only part with a recommendation to act on
now; everything else is a position to hold while the business gets big enough
to test it.

The starting question was "should Locare be built on Hyperledger Fabric". The
answer to that is no (§8). The question worth keeping is narrower: **is there a
multi-agency tenant payment record worth building, and does it need a chain?**

---

## 1. The problem, from both sides

A South African tenant who has paid R12 000 a month on time for four years has
built nothing from it. Every new lease application starts at zero — payslips,
bank statements, a credit check. Reliability is not portable, so it is not an
asset.

An agency screening that tenant is guessing. It prices risk with blunt
instruments — affordability multiples, deposits, sometimes a guarantor —
because it cannot see behaviour, only capacity.

Both sides lose. That is a real problem, and it is why TPN exists.

---

## 2. The incumbent — and the finding that matters

**TPN (Tenant Profile Network)** already does this centrally: an NCR-registered
credit bureau (NCRCB08), a network of 5 000+ property managers, estate agents
and landlords, up to five years of rental payment history per tenant, an
Experian partnership, now under MRI Software.

Two consequences.

### 2.1 This is a licensed activity, not just a regulated one

TPN is not a data co-operative. It is a **registered credit bureau under the
National Credit Act**. Before any architecture conversation, the question is
whether sharing tenant payment history between agencies constitutes operating
as a credit bureau, and therefore requires NCR registration.

That is not a POPIA question and it is not answerable by design. It sits
underneath everything in this document.

**Action: one hour with an attorney before one hour with Fabric.** Ask
specifically: (a) does agency-to-agency sharing of rental payment behaviour
require NCR credit bureau registration; (b) does it change if the tenant holds
and presents the record rather than agencies querying a database; (c) what
POPIA basis applies, and is consent obtained as a condition of a lease
"freely given".

### 2.2 Head-on competition is not winnable from here

One agency, no paying customers, one person, against 5 000 reporters and
Experian. The network effect runs entirely against us: the data is worthless
without scale, and scale is unreachable without data.

Any version of this that starts by trying to replace TPN fails.

---

## 3. Three wedges TPN structurally cannot close

### 3.1 They have payment history; Locare has the whole tenancy

Inspections with photographs, condition reports, deposit handling, maintenance
responsiveness, lease documents, communication history. A **tenancy record** is
richer than a payment score.

The asymmetry that matters: TPN's reporters key data in by hand, so their data
is as complete as someone remembered to make it. Locare's would be a by-product
of the product working — automatic, and therefore complete.

### 3.2 It is one-sided, and it does not have to be

Tenants have no way to know whether a landlord is slow on repairs, unreasonable
at deposit refund, or casual about access. TPN will never build this: their
customer is the agent.

A **mutual** record is genuinely differentiated. It is also the thing that makes
tenant consent real rather than coerced — a tenant opts in because they get
something, which is a materially better POPIA position than consent extracted
as a condition of tenancy.

### 3.3 Reciprocity beats purchase

TPN charges per check. A consortium where members contribute and query on a
mutual basis is structurally cheaper. *"Unlimited tenant checks, included"* is a
real reason to choose Locare over a competitor — and it converts a cost line on
the agency's P&L into a reason to stay.

---

## 4. What the record actually is

Not a score. A set of **signed attestations**, each one a fact an agency is
willing to put its name to:

- tenancy ran from X to Y at a property managed by agency A
- N payments due, M paid on or before due date, K late by more than 7 days
- deposit refunded in full / with deductions of R…
- no / some / repeated breaches of lease
- (mutual) maintenance requests: N raised, median time to resolution

Each attestation is signed by the issuing agency. The tenant holds it. The next
agency verifies the signature against the issuer's published key.

**PII never goes on any shared ledger.** At most a hash of the attestation, so
issuance cannot later be denied and revocation can be published. The record
itself stays with the issuer and the tenant. This is what keeps POPIA's right
to deletion compatible with a tamper-evident design.

---

## 5. Does it need a chain?

**Most of the value needs signatures, not consensus.** W3C Verifiable
Credentials with DIDs gets: issuance, tenant-held storage, selective
disclosure, and verification. No network, no consensus, no operational weight.

A chain adds exactly three things:

1. a shared **revocation registry** — proving an attestation is still valid
2. **non-repudiation of issuance** — an agency cannot deny it issued something
3. a shared **membership registry and governance** — who may issue, who may
   verify, who admits and removes members

Those matter only if the members refuse to accept a central operator holding
the registry. Which brings us to the crux.

### 5.1 The crux

**A consortium needs a chain only when members will not accept a central
operator.**

Small independent agencies will never run a Fabric peer. If Locare runs every
peer on their behalf, we have built a database with a consensus tax and called
it decentralised. That version should not be built.

The version that genuinely needs Fabric is the **franchise groups** — the
national brands. They are real competitors, they have IT capability, and none
of them will hand tenant data to a rival or to a startup. Known parties, mutual
distrust, bilateral sharing with shared verification: that is precisely the
Fabric shape, including private data collections for attestation bodies with
only hashes on the common channel.

And convening four national franchise groups is a **business development
problem**, not an engineering one. It is a question Locare will be able to ask
only once it has the standing to get them in a room.

---

## 6. What breaks if this is built badly

| Risk | Why it matters |
|---|---|
| NCR licensing | Operating as an unregistered credit bureau. Existential, not technical. §2.1. |
| Coerced consent | POPIA consent obtained as a condition of a lease may not be "freely given". The mutual model (§3.2) is the mitigation. |
| Right to deletion vs immutability | Solved by keeping PII off-ledger; broken immediately if anyone puts a name on a chain. |
| Retaliatory or self-serving attestations | An agency may report favourably to offload a difficult tenant, or punitively out of a dispute. Needs a dispute process and, eventually, consequences for members who abuse it. |
| Cold start | One agency's data is worth nothing. This is the hardest constraint and no architecture solves it. |
| Governance | Who admits members, who arbitrates a disputed record, what happens on exit. Consortia die here far more often than they die of technology. |

---

## 7. What to do now — the only actionable part

**Start signing and hash-chaining payment attestations today.**

Every rent payment Locare records already exists. Adding a signed, chained
attestation alongside it is roughly the same week of work as the tamper-evidence
proposal for the trust ledger, and the two share almost all their machinery:

- each attestation carries a hash of the previous one for that tenancy
- signed with a per-agency key
- periodic Merkle roots published, optionally anchored externally
- PII stays in Postgres; the attestation carries figures and dates

**Why now, when the consortium may never happen:** it is free optionality. If a
network ever exists, Locare's agencies arrive with years of verifiable history
while everyone else starts at zero. If it never happens, we still have
tamper-evident trust accounting and can hand a departing tenant a verifiable
record of their own tenancy — which is a good feature on its own.

A week of work for a first-mover position on a five-year play is a trade worth
making.

### 7.1 The pragmatic near-term feature: integrate with TPN

Not compete — **report to them**. *"Locare reports your tenants to TPN
automatically"* removes a real objection from agencies who already pay for it,
generates goodwill, and teaches us how this market actually behaves before we
try to reshape it.

It is also the cheapest possible market research on whether agencies value
payment history enough to change providers over it.

---

## 8. Why not build Locare on Fabric

Recorded so the question does not get re-opened without new information.

Blockchain earns its cost when mutually distrusting parties need shared state
without a trusted operator. Locare today has one operator and no consensus
problem — agencies trust Locare, tenants trust the agency, owners trust the
agency.

Concretely, moving the core onto Fabric would:

- **break reporting** — income statements, owner statements, CSV exports are SQL
  aggregation; Fabric's state model is key-value with rich queries at best
- **weaken tenant isolation** — RLS has no Fabric equivalent; privacy moves to
  channels and private data collections, configured at network level rather than
  enforced per query
- **collide with POPIA** — the retention purge exists because deletion is a
  right; an immutable ledger holding personal data fights that directly
- **add a platform team's operational load** — peers, Raft ordering, CAs, MSPs,
  channel config, chaincode lifecycle — to a one-person team that has not yet
  taken a live payment, has no production error tracking, and has an unverified
  backup restore

The property actually wanted was *"prove the ledger was not tampered with"*.
That is a hash chain plus published Merkle roots: days of work, no new runtime,
and verifiable by someone outside Locare — which is the part that matters.

---

## 9. The strategic reframe

The interesting asset is not the blockchain. It is the **network**.

If Locare agencies get better tenant data than non-Locare agencies, that is a
moat no competitor can copy by shipping a feature. And it works with a single
operator long before it needs consensus — which means the network can be built,
tested and monetised years before the question of decentralisation has to be
answered at all.

Build the network first. Decentralise it only when someone refuses to join
without that.

---

## Sources

- [TPN Credit Bureau — About](https://www.tpn.co.za/Group/Home/About)
- [TPN — Credit checks](https://www.tpn.co.za/Property/Home/CreditChecks)
- [Experian and TPN team up on rental data](https://www.biia.com/south-africa-experian-and-tpn-team-up-on-rental-data/)
- [TPN under MRI Software](https://mrisoftware.tpn.co.za/)

Researched August 2026. TPN's registration number, network size and history
depth are as published by TPN; the NCA licensing question in §2.1 is an
inference from their credit bureau registration and has **not** been confirmed
by an attorney.

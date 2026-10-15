# Running the Locare demo

A walkthrough for showing Locare to a prospect on a laptop, with no help from a
developer. Everything runs locally — no internet connection is needed once the
machine is set up, and nothing you do here touches the live system or any real
customer.

The demo world is **Midnight Masquerade**, a fictional Cape Town rental agency
with a full portfolio and twelve months of trading history behind it.

---

## Before you start

You need:

- **Docker Desktop running.** Look for the whale icon in the system tray. If it
  isn't there, open Docker Desktop from the Start menu and wait until it says
  *Engine running*. The demo will not start without it.
- The project folder at `C:\xampp\htdocs\development\PMS0.3`.
- About 10 minutes for the first start of the day, 2 minutes after that.

Open **PowerShell** and go to the folder. Every command below is run from here:

```powershell
cd C:\xampp\htdocs\development\PMS0.3
```

---

## 1. Choose which story you're telling

Locare can be deployed three ways, and the demo shows whichever one the prospect
cares about. Pick it **before** starting — changing it later means restarting.

```powershell
.\scripts\demo-mode.ps1 a
```

| Command | What the prospect sees |
|---|---|
| `.\scripts\demo-mode.ps1 a` | **On-site, back office.** Sealed — staff only. Listings and applications are gone from the menu, and tenant and landlord sign-in are refused outright. For an agency that wants nothing exposed to the internet. |
| `.\scripts\demo-mode.ps1 b` | **On-site, connected.** The back office on their premises, with tenants and owners still able to reach their portals. |
| `.\scripts\demo-mode.ps1 c` | **Private server.** Everything hosted, everything available. The standard offering. |

Run it with no letter to see which mode is currently set:

```powershell
.\scripts\demo-mode.ps1
```

If it warns that two settings disagree, just run it again with a letter.

---

## 2. Start everything

```powershell
.\scripts\start-all.ps1
```

Several windows will open — one for the API, one for the back office, and two
for the mobile apps. **Leave them all open.** They are the demo running; closing
one stops that part.

Wait until the back office window shows `ready` and a line mentioning
`localhost:3001`. First start of the day takes a few minutes.

> Use `.\scripts\start-all.ps1 -Setup` instead only if a developer has told you
> to, or if the demo data looks wrong. It takes considerably longer because it
> rebuilds and reloads everything — and if you run it, follow with step 3.
>
> Add `-NoMobile` if you aren't showing the tenant and landlord apps; it starts
> faster and opens fewer windows.

---

## 3. Load the Midnight Masquerade world

```powershell
npm run seed:prospect -- midnight-masquerade
```

You only need this the first time on a machine, or after a `-Setup` run. It is
safe to run again at any point — it tops up what's missing rather than creating
a second copy.

---

## 4. Open your tabs

Set these up before the prospect is watching:

| What | Address |
|---|---|
| **Demo console** — your control panel for the demo | http://localhost:3001/demo |
| **Back office** — the main product | http://localhost:3001 |
| **Inbox** — where sign-in codes arrive | http://localhost:8025 |

---

## Signing in

There are no passwords. You enter an email address, the system emails a
six-digit code, and you type it in. This is how the real product works, and it
demos well — it's worth calling out as a feature.

The code arrives in the **inbox tab** at http://localhost:8025, usually within a
second or two. Click the newest message to read it. Keep that tab open but not
in front of the prospect unless you're deliberately showing the email itself —
the emails are branded as Midnight Masquerade, so showing one is a good way to
make the white-label point.

| Who | Email | What they see |
|---|---|---|
| Celeste Marais — agency owner | `celeste@midnightmasquerade.demo` | Everything. Start here. |
| Thabo Nkosi — property manager | `thabo@midnightmasquerade.demo` | Day-to-day management, no company settings |
| Riaan de Villiers — property manager | `riaan@midnightmasquerade.demo` | Same as Thabo |
| Sipho Dlamini — tenant | `tenant@demo.locare.co.za` | The tenant app. Lives at Masquerade Heights 304 |
| Annelize Fourie — landlord | `landlord@demo.locare.co.za` | The owner portal. Owns Venetian Mews and Volto Street Houses |

Codes expire after five minutes. If one lapses, just request another.

In **mode A**, the tenant and landlord sign-ins are refused on purpose — that
refusal is the point of that mode, not a fault.

---

## Switching mode in front of the prospect

Sometimes worth doing live — it makes the deployment options concrete.

```powershell
.\scripts\demo-mode.ps1 b
```

Then restart two of the open windows: press `Ctrl+C` in each, and run

- `npm run start:dev` in the **PMS API (3000)** window
- `npm run dev` in the **PMS Web (3001)** window

The data is untouched across a switch — same agency, same units, same history.
Allow about a minute, and say what you're doing while it restarts.

---

## If something goes wrong

**Nothing loads at localhost:3001.** Check the back office window is still open
and hasn't stopped with an error. If it has, run `.\scripts\start-all.ps1`
again.

**No email arrives.** Check http://localhost:8025 loads at all. If it doesn't,
Docker isn't running — start Docker Desktop, then re-run
`.\scripts\start-all.ps1`. Codes cannot arrive without it.

**"Port already in use" or odd behaviour after a crash.** Close all the demo
windows and run `.\scripts\start-all.ps1` again. It clears the old ones out.

**The data looks wrong or half-loaded.** Run `npm run seed:prospect --
midnight-masquerade` again.

**A payment screen behaves strangely.** Expected. Payment collection is not
connected to anything live, so a payment will not complete end to end. Show the
invoice, the statement and the ledger instead — that's the stronger story.

---

## Worth knowing

- Nothing here is real. The money, the tenants and the history are invented, and
  none of it reaches a live system. You cannot break anything a developer can't
  reset in a few minutes.
- Every figure reconciles. The statements, the ledger and the outstanding
  balances were generated through the same accounting engine the real product
  uses, so you can open any statement in front of a prospect and it will add up.
- Don't demo from a machine that has been asleep for days without starting it
  once beforehand. First start of the day is the slow one — get it out of the
  way before anyone is watching.

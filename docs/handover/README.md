# Handover — session history

Everything from the Cowork sessions that built Locare, in a form that survives
moving to another Claude account. Neither the conversation nor the task list is
exportable through the app, so both are reconstructed here from the on-disk
session log.

| File | What it is |
|---|---|
| `transcript.md` | The full conversation, 1 Jul – 13 Aug 2026 (35 days). 501 messages from Arthur, ~5,800 from Claude, ~3,600 tool calls. Tool results summarised to one line each. **Credential-scrubbed.** |
| `TASKS.md` | All 223 tracked tasks, grouped by phase, with the four still open. |

The raw `.jsonl` is deliberately **not** kept here — see the security note below.

`../../CLAUDE.md` is the distilled version — architecture, conventions and
gotchas. Claude reads it automatically. **Start there.** These files are the
archive you consult when you need to know *why* something was done.

## Regenerating

The exporter is `scripts/export-transcript.py`. Session logs live under:

```
%APPDATA%\Claude\local-agent-mode-sessions\<a>\<b>\<c>\.claude\projects\<project>\<id>.jsonl
```

```bash
python scripts/export-transcript.py path/to/session.jsonl -o docs/handover/transcript.md
python scripts/export-transcript.py path/to/session.jsonl -o full.md --thinking   # include reasoning
```

## A note on size

`transcript.md` is 3 MB — too big to paste into a chat, and too big for Claude to
read in one go. To bring the new account up to speed, point it at `CLAUDE.md`
first, then grep the transcript for the specific thing you need:

```bash
grep -n -i "brand resolution" docs/handover/transcript.md
grep -n "## 2026-08-12" docs/handover/transcript.md   # jump to a day
```

## Security

**Terminal output pasted into chat ends up in the log.** A single
`grep POSTGRES deploy/.env.prod` during a debugging session put the production
database password into the raw transcript — so the exporter scrubs before
writing. It masks `KEY=value` pairs for known secret names, `Bearer` tokens,
JWTs, and inline credentials in Postgres URLs.

Verified on the current export: no unredacted secret assignments, no JWTs, no
private keys, and the production password is gone.

The **raw `.jsonl` is not scrubbed** and must not be committed. It's gitignored
(`docs/handover/*.jsonl*`), and the original is still in the Claude app folder
under `%APPDATA%` if you ever need it. Don't copy it into the repo.

If you regenerate, don't pass `--no-redact` on anything that gets committed.

What does remain here: hostnames, the infrastructure layout, the Demo Agency's
fictional data, and every architectural decision. Internal, not public.

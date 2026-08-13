#!/usr/bin/env python3
"""
Export a Claude Cowork session transcript to readable Markdown.

The raw .jsonl is the source of truth but it's mostly tool payloads and
attachments — 65MB for a session whose actual conversation is a fraction of
that. This keeps what a human (or a future Claude) needs to reconstruct intent:
what was asked, what was answered, and which tools ran. Tool *results* are
summarised to a line, not dumped.

  python scripts/export-transcript.py <session.jsonl> -o docs/handover/transcript.md

Find the source file under:
  %APPDATA%\\Claude\\local-agent-mode-sessions\\...\\.claude\\projects\\<project>\\<id>.jsonl

Options:
  --thinking      include the assistant's reasoning blocks (verbose)
  --tool-args N   characters of tool input to show (default 220, 0 to hide)
"""
import argparse
import json
import re
import sys
from datetime import datetime

# ── Redaction ────────────────────────────────────────────────────────────────
# Terminal output gets pasted into chat, so real credentials end up in the log —
# a `grep POSTGRES deploy/.env.prod` is all it takes. Scrub before the transcript
# lands anywhere version-controlled.
SECRET_KEYS = (
    'POSTGRES_PASSWORD|DB_PASSWORD|JWT_SECRET|PII_ENCRYPTION_KEY|SESSION_SECRET|'
    'SMTP_PASS|SMTP_PASSWORD|WHATSAPP_TOKEN|ANTHROPIC_API_KEY|OPENAI_API_KEY|'
    'SENDGRID_API_KEY|TWILIO_AUTH_TOKEN|IKHOKHA_[A-Z_]*(?:KEY|SECRET)|'
    'PAYFAST_[A-Z_]*(?:KEY|PASSPHRASE)|PAYSTACK_SECRET_KEY|YOCO_[A-Z_]*KEY|'
    'PEACH_[A-Z_]*(?:KEY|TOKEN)|STITCH_CLIENT_SECRET|STITCH_WEBHOOK_SECRET|'
    'GOOGLE_CLIENT_SECRET|[A-Z_]*_SECRET|[A-Z_]*_API_KEY|[A-Z_]*_TOKEN'
)
REDACTIONS = (
    # KEY=value in env files, shell pastes and compose output
    (re.compile(rf'\b({SECRET_KEYS})(\s*[=:]\s*)(["\']?)([^\s"\'`,;\n]{{4,}})'),
     lambda m: f'{m.group(1)}{m.group(2)}{m.group(3)}«redacted»'),
    # Bearer / Authorization headers
    (re.compile(r'(Bearer\s+)[A-Za-z0-9._\-]{12,}'), r'\1«redacted»'),
    # JWTs anywhere
    (re.compile(r'\beyJ[A-Za-z0-9._\-]{20,}'), '«redacted-jwt»'),
    # Postgres URLs with inline credentials
    (re.compile(r'(postgres(?:ql)?://[^:\s]+:)([^@\s]+)(@)'), r'\1«redacted»\3'),
)

def redact(text: str) -> str:
    for pattern, repl in REDACTIONS:
        text = pattern.sub(repl, text)
    return text

def ts(raw: str) -> str:
    """ISO timestamp -> '2026-08-12 14:59'. Returns '' if unparseable."""
    if not raw:
        return ''
    try:
        return datetime.fromisoformat(raw.replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')
    except ValueError:
        return raw[:16]

def clip(text: str, n: int) -> str:
    text = ' '.join(str(text).split())
    return text if len(text) <= n else text[:n] + '…'

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('source')
    ap.add_argument('-o', '--out', default='transcript.md')
    ap.add_argument('--thinking', action='store_true')
    ap.add_argument('--tool-args', type=int, default=220)
    ap.add_argument('--no-redact', action='store_true',
                    help='skip credential scrubbing (do not use for anything committed)')
    a = ap.parse_args()
    scrub = (lambda s: s) if a.no_redact else redact

    out = []
    stats = {'user': 0, 'assistant': 0, 'tools': 0, 'skipped': 0}
    last_day = None

    with open(a.source, encoding='utf-8') as fh:
        for line in fh:
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                stats['skipped'] += 1
                continue

            kind = rec.get('type')
            if kind not in ('user', 'assistant'):
                continue

            when = ts(rec.get('timestamp', ''))
            day = when[:10]
            if day and day != last_day:
                out.append(f'\n\n---\n\n## {day}\n')
                last_day = day

            msg = rec.get('message', {})
            content = msg.get('content')

            # ── user ──────────────────────────────────────────────────────
            if kind == 'user':
                # Tool results arrive as user-role records; keep them terse.
                if isinstance(content, list):
                    for b in content:
                        if b.get('type') == 'tool_result':
                            body = b.get('content')
                            if isinstance(body, list):
                                body = ' '.join(
                                    x.get('text', '') for x in body if isinstance(x, dict)
                                )
                            flag = ' (error)' if b.get('is_error') else ''
                            out.append(f'> ↳ result{flag}: {scrub(clip(body or "", 160))}\n')
                    continue
                text = content if isinstance(content, str) else ''
                if not text.strip():
                    continue
                # System reminders are injected context, not things Arthur said.
                if text.lstrip().startswith('<system-reminder>'):
                    continue
                stats['user'] += 1
                out.append(f'\n### 🧑 Arthur · {when}\n\n{scrub(text.strip())}\n')
                continue

            # ── assistant ─────────────────────────────────────────────────
            if not isinstance(content, list):
                continue
            parts = []
            for b in content:
                bt = b.get('type')
                if bt == 'text' and b.get('text', '').strip():
                    parts.append(scrub(b['text'].strip()))
                elif bt == 'thinking' and a.thinking and b.get('thinking', '').strip():
                    parts.append(f'<details><summary>reasoning</summary>\n\n'
                                 f'{scrub(b["thinking"].strip())}\n\n</details>')
                elif bt == 'tool_use':
                    stats['tools'] += 1
                    name = b.get('name', '?')
                    if a.tool_args:
                        args = json.dumps(b.get('input', {}), ensure_ascii=False)
                        parts.append(f'`⚙ {name}` — {scrub(clip(args, a.tool_args))}')
                    else:
                        parts.append(f'`⚙ {name}`')
            if not parts:
                continue
            stats['assistant'] += 1
            out.append(f'\n### 🤖 Claude · {when}\n\n' + '\n\n'.join(parts) + '\n')

    header = (
        '# Session transcript\n\n'
        f'Exported {datetime.now().strftime("%Y-%m-%d %H:%M")} from `{a.source}`.\n\n'
        f'{stats["user"]} messages from Arthur · {stats["assistant"]} from Claude · '
        f'{stats["tools"]} tool calls'
        + ('' if a.thinking else ' · reasoning omitted (use --thinking)')
        + '\n\nTool results are summarised to one line. The original `.jsonl` is the '
          'complete record if you need exact payloads.\n'
    )

    with open(a.out, 'w', encoding='utf-8') as fh:
        fh.write(header + ''.join(out))

    print(f'wrote {a.out}')
    print(f'  {stats["user"]} user · {stats["assistant"]} assistant · '
          f'{stats["tools"]} tool calls · {stats["skipped"]} unparsed')
    return 0

if __name__ == '__main__':
    sys.exit(main())

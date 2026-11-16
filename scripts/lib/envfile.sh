# Shared .env readers/writers for the Linux launchers.
#
# Sourced, never executed. Kept in one file because demo-up.sh and
# demo-mode.sh both need them and a second copy is a second thing to get wrong.

# env_get FILE KEY -> prints the value, or nothing when absent.
env_get() {
  local file=$1 key=$2
  [ -f "$file" ] || return 0
  sed -n "s/^${key}=//p" "$file" | head -n1 | sed 's/[[:space:]]*$//'
}

# env_set FILE KEY VALUE — replaces the one line, leaves every other alone,
# creates the file if needed. Appends a trailing newline when the file lacks one,
# so the next append does not land on the end of an existing setting.
env_set() {
  local file=$1 key=$2 value=$3
  mkdir -p "$(dirname "$file")"
  [ -f "$file" ] || : > "$file"
  if grep -qE "^${key}=" "$file"; then
    # A value may contain / and &, so use a delimiter that cannot appear in a
    # key and escape the replacement rather than trusting it.
    python3 - "$file" "$key" "$value" <<'PY'
import io, re, sys
path, key, value = sys.argv[1], sys.argv[2], sys.argv[3]
s = io.open(path, encoding='utf-8', newline='').read()
s = re.sub(rf'(?m)^{re.escape(key)}=.*$', lambda _: f'{key}={value}', s)
io.open(path, 'w', encoding='utf-8', newline='').write(s)
PY
  else
    [ -s "$file" ] && [ "$(tail -c1 "$file")" != "" ] && printf '\n' >> "$file"
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# free_port PORT — stop whatever is listening, with the tool that exists.
free_port() {
  local port=$1 pids=''
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  elif command -v fuser >/dev/null 2>&1; then
    pids=$(fuser -n tcp "$port" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' || true)
  elif command -v ss >/dev/null 2>&1; then
    pids=$(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 || true)
  else
    printf '  cannot free port %s: install lsof, psmisc or iproute2\n' "$port" >&2
    return 0
  fi
  for pid in $pids; do
    printf '  freeing port %s (PID %s)\n' "$port" "$pid"
    kill "$pid" 2>/dev/null || true
    sleep 0.3
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  done
}

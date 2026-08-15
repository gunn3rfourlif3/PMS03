/**
 * Generate the voiceover with ElevenLabs.
 *
 *   $env:ELEVENLABS_API_KEY="..."
 *   node scripts/video/tts.mjs --voices     # see what your account can use
 *   node scripts/video/tts.mjs              # synthesise the script
 *
 * Writes one WAV per beat to docs/video/vo/. The assembler reads those files and
 * uses each one's LENGTH as that beat's duration, so picture and voice can't
 * drift — retiming the cut means rewriting a sentence, not chasing numbers.
 *
 * ACCENT: none of the ElevenLabs premade voices are South African. For selling
 * to SA agencies that's worth fixing — search "South African" in the ElevenLabs
 * Voice Library, add the voice to your account, then:
 *     $env:VOICE="Name or voice_id"
 * VOICE accepts either, so a library voice needs no code change.
 *
 * Options:
 *   VOICE=Alice        voice name or ID (default: first available female voice)
 *   SPEED=0.95         0.7–1.2; below 1.0 reads calmer. Suits a product demo.
 *   MODEL=...          default eleven_multilingual_v2 (best quality per character)
 *   FORCE=1            re-synthesise lines that already exist
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = 'docs/video/vo';
const API = 'https://api.elevenlabs.io/v1';
// Tolerate the two ways this gets pasted wrong: the whole `NAME=value` line
// copied into the value, and stray surrounding quotes. Both fail as a bare 401,
// which sends you looking at your account rather than at the string.
const KEY = (process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || '')
  .trim()
  .replace(/^ELEVEN(LABS)?_API_KEY\s*=\s*/i, '')
  .replace(/^["']|["']$/g, '')
  .trim();
const MODEL = process.env.MODEL || 'eleven_multilingual_v2';
const SPEED = Number(process.env.SPEED || '0.95');
const FORCE = process.env.FORCE === '1';

// Tried in order when VOICE isn't set. All female; the first one the account
// actually has wins, so this works on a fresh free account and on a stocked one.
const PREFERRED = ['Alice', 'Charlotte', 'Sarah', 'Matilda', 'Rachel', 'Lily'];

if (!KEY) {
  console.error('\nELEVENLABS_API_KEY is not set.\n');
  console.error('  elevenlabs.io -> profile icon -> API Keys.\n');
  console.error('  $env:ELEVENLABS_API_KEY="..."\n');
  console.error('  The full script is ~1,500 characters, well inside the free monthly quota.\n');
  process.exit(1);
}

const req = async (path, init = {}) => {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { 'xi-api-key': KEY, ...(init.headers || {}) },
    });
  } catch (e) {
    // A bare "TypeError: fetch failed" tells you nothing about which of the
    // three likely causes it is.
    console.error('\nCould not reach api.elevenlabs.io.');
    console.error('  Check your connection, VPN, or corporate proxy.\n');
    console.error(`  (${String(e.cause?.message || e.message)})\n`);
    process.exit(1);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 401) {
      console.error('\nElevenLabs rejected the key.\n');
      console.error(`  Sent: ${KEY.slice(0, 6)}…${KEY.slice(-4)}  (${KEY.length} chars)`);
      console.error('  A real key looks like sk_ followed by ~48 characters.\n');
      console.error('  $env:ELEVENLABS_API_KEY="sk_..."      <- value only, no name, no quotes inside\n');
      process.exit(1);
    }
    throw new Error(`${res.status} ${res.statusText} ${body.slice(0, 300)}`);
  }
  return res;
};

/** Voices the account can use, with the labels that matter when choosing one. */
async function listVoices() {
  const { voices } = await (await req('/voices')).json();
  return voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    gender: v.labels?.gender || '',
    accent: v.labels?.accent || '',
    desc: v.labels?.description || '',
  }));
}

if (process.argv.includes('--voices')) {
  // Confirm the key works and show what's left, so a failure later is clearly
  // about the request rather than the account.
  try {
    const sub = await (await req('/user/subscription')).json();
    const used = sub.character_count ?? 0;
    const cap = sub.character_limit ?? 0;
    console.log(`\nkey OK — tier "${sub.tier}", ${used}/${cap} characters used this period`);
    if (cap - used < 2000) {
      console.log('  WARNING: under 2,000 characters left; the full script needs ~1,500.');
    }
  } catch (e) {
    console.log(`\ncould not read subscription: ${String(e).slice(0, 120)}`);
  }

  const voices = await listVoices();
  console.log(`\n${voices.length} voices on this account:\n`);
  for (const v of voices) {
    const tags = [v.gender, v.accent, v.desc].filter(Boolean).join(', ');
    console.log(`  ${v.name.padEnd(16)} ${v.id}  ${tags}`);
  }
  console.log('\n  $env:VOICE="Name"   then: node scripts/video/tts.mjs\n');
  process.exit(0);
}

/** Resolve VOICE (a name or an ID) against the account, or pick a female voice. */
async function resolveVoice() {
  const want = process.env.VOICE || '';
  const voices = await listVoices();

  // ElevenLabs ships voices as "Alice - Clear, Engaging Educator", so an exact
  // match on "Alice" finds nothing. Match the leading name, which is the part
  // anyone would actually type.
  const byName = (n) => {
    const q = n.trim().toLowerCase();
    return (
      voices.find((v) => v.name.toLowerCase() === q) ||
      voices.find((v) => v.name.toLowerCase().split(/\s*[-–(]/)[0].trim() === q) ||
      voices.find((v) => v.name.toLowerCase().startsWith(q))
    );
  };

  if (want) {
    const hit = byName(want) || voices.find((v) => v.id === want);
    if (hit) return hit;
    // An ID from the Voice Library that isn't added to the account yet still
    // works for synthesis, so don't refuse it — just say we couldn't verify.
    if (/^[A-Za-z0-9]{20,}$/.test(want)) {
      console.log(`  using voice id ${want} (not in your voice list — assuming Voice Library)`);
      return { id: want, name: want, gender: '', accent: '' };
    }
    console.error(`\nNo voice named "${want}". Run: node scripts/video/tts.mjs --voices\n`);
    process.exit(1);
  }

  for (const n of PREFERRED) {
    const hit = byName(n);
    if (hit) return hit;
  }
  const female = voices.find((v) => (v.gender || '').toLowerCase() === 'female');
  if (female) return female;
  console.error('\nNo female voice found. Run --voices and set VOICE explicitly.\n');
  process.exit(1);
}

const voice = await resolveVoice();
const lines = JSON.parse(readFileSync(join(HERE, 'narration.json'), 'utf8'));

/**
 * Phonetic respellings, applied on the way to the engine only.
 *
 * The product is named for the Latin verb — loh-KAH-reh — and every TTS engine
 * reads it as "loh-CARE" without help. Keeping the map separate means the script
 * and the burnt-in captions stay spelled properly; only the audio is respelled.
 */
const SAY = lines._pronounce || {};
const speakable = (text) =>
  Object.entries(SAY).reduce(
    (t, [word, as]) => t.replace(new RegExp(`\\b${word}\\b`, 'gi'), as),
    text,
  );

const entries = Object.entries(lines)
  .filter(([k, v]) => !k.startsWith('_') && typeof v === 'string' && v.trim())
  .map(([k, v]) => [k, speakable(v)]);

if (Object.keys(SAY).length) {
  console.log(
    `\npronunciation: ${Object.entries(SAY).map(([w, a]) => `${w} -> ${a}`).join(', ')}`,
  );
}

mkdirSync(OUT, { recursive: true });

/**
 * One request per beat, but each carries the neighbouring lines as context.
 * ElevenLabs uses them for prosody only (they aren't spoken), so the delivery
 * flows across the cut instead of every sentence landing like a fresh start.
 */
async function speak(id, text, prev, next) {
  const file = join(OUT, `${id}.wav`);
  if (!FORCE && existsSync(file) && statSync(file).size > 1000) {
    console.log(`  = ${id} (exists)`);
    return;
  }

  const body = {
    text,
    model_id: MODEL,
    previous_text: prev || undefined,
    next_text: next || undefined,
    voice_settings: {
      stability: 0.5,          // steady, not flat — a demo VO shouldn't emote
      similarity_boost: 0.75,
      style: 0.15,
      use_speaker_boost: true,
      speed: SPEED,
    },
  };

  let res;
  try {
    res = await req(`/text-to-speech/${voice.id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // `speed` is rejected by some model/plan combinations. Losing the pacing
    // tweak beats losing the whole run.
    if (!/422|speed/i.test(String(e))) throw e;
    delete body.voice_settings.speed;
    res = await req(`/text-to-speech/${voice.id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // The assembler globs for .wav and reads durations with ffprobe, so convert
  // here rather than teaching it about two formats. 48k mono matches the mix.
  const mp3 = join(OUT, `${id}.mp3`);
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '48000', '-ac', '1', file]);

  const secs = Number(
    execFileSync('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
    ]).toString().trim(),
  );
  console.log(`  + ${id}  ${secs.toFixed(1)}s  "${text.slice(0, 52)}${text.length > 52 ? '…' : ''}"`);
}

console.log(
  `\nSynthesising ${entries.length} lines as ${voice.name}` +
    `${voice.accent ? ` (${voice.accent})` : ''}, speed ${SPEED}, ${MODEL}\n`,
);

let chars = 0;
for (let i = 0; i < entries.length; i++) {
  const [id, text] = entries[i];
  chars += text.length;
  await speak(id, text, entries[i - 1]?.[1], entries[i + 1]?.[1]);
}

console.log(`\n${chars} characters. Files in ${OUT}/`);
console.log('Now run: npm run video   (or: bash scripts/video/assemble.sh)\n');

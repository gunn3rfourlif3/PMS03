// Same .env load that data-source.ts does, so the probe checks the port the
// tests will actually connect to. Without this it defaults to 5432 while the
// dev stack runs Postgres on 5433, and every DB spec silently skips.
require('dotenv/config');
const net = require('node:net');

/**
 * Probe for a reachable Postgres before any test file is loaded, and record the
 * answer in DB_AVAILABLE so DB-backed suites can use `describe.skip` rather
 * than a runtime guard.
 *
 * The distinction matters: a runtime guard that returns early reports the suite
 * as PASSED when there is no database, which is a lie that looks exactly like
 * success. `describe.skip` reports it as skipped, which is the truth.
 *
 * Runs before collection because Jest decides skip-vs-run at collection time,
 * and a connection attempt is async.
 */
module.exports = async function globalSetup() {
  const url = process.env.DATABASE_URL || 'postgres://pms:pms@localhost:5432/pms';
  let host = 'localhost';
  let port = 5432;
  try {
    const u = new URL(url);
    host = u.hostname || host;
    port = Number(u.port) || port;
  } catch {
    /* fall through to defaults */
  }

  const reachable = await new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (ok) => {
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(1500);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
  });

  process.env.DB_AVAILABLE = reachable ? '1' : '0';
  if (!reachable) {
    console.warn(
      `\n  ⚠ No Postgres at ${host}:${port} — DB-backed specs will be SKIPPED, not passed.` +
        `\n    Start one with:  .\\scripts\\start-all.ps1 -Setup\n`,
    );
  }
};

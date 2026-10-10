// Metro config for the landlord app.
//
// Exists for ONE reason: `shared/i18n/` lives above this app's root, so that the
// two Expo apps and web-admin can import the same message catalogue. Metro only
// watches (and will only resolve) files under `projectRoot` plus `watchFolders`,
// so without the entry below a relative import of `../../shared/i18n` fails at
// bundle time with "Unable to resolve module".
//
// Deliberately NOT a path alias: an `@shared/*` alias would need
// `babel-plugin-module-resolver`, a new dependency, and the build plan says to
// stop rather than add one. Relative imports need no plugin, so the screens use
// `../../shared/i18n` and read a little worse in exchange for no new package.
//
// `expo/metro-config` is already a transitive dependency of `expo`, so this file
// adds nothing to package.json.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Only `shared/` — not the whole repo. Watching the repo root would pull
// web-admin's and the API's node_modules into Metro's file map and slow every
// rebuild for no benefit.
config.watchFolders = [path.resolve(repoRoot, 'shared')];

// Keep resolution anchored to THIS app's node_modules. Without this, a module
// required from a watched folder outside the project can resolve against the
// repo root's node_modules and load a second copy of React.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;

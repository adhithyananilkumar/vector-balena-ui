/*
 * Builds Vector's device type catalogue (display names + board logos) from a checkout of balena's public
 * contracts repository (https://github.com/balena-io/contracts, Apache-2.0).
 *
 *   git clone --depth 1 https://github.com/balena-io/contracts.git /tmp/contracts
 *   node scripts/sync-device-types.cjs /tmp/contracts
 *
 * Writes public/device-types/<slug>.svg and src/vector/data/deviceTypes.json. Logos are served only through <img>,
 * where browsers do not run scripts, and files that contain script or event handlers are skipped anyway.
 */
const fs = require('fs');
const path = require('path');

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/sync-device-types.cjs <path to balena-io/contracts>');
  process.exit(1);
}
const root = path.join(source, 'contracts', 'hw.device-type');
const outDir = path.join(__dirname, '..', 'public', 'device-types');
const catalogPath = path.join(__dirname, '..', 'src', 'vector', 'data', 'deviceTypes.json');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.dirname(catalogPath), { recursive: true });

const SLUG = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const catalog = {};
let logos = 0;
let skipped = 0;

for (const slug of fs.readdirSync(root).sort()) {
  if (!SLUG.test(slug)) continue;
  const contractFile = path.join(root, slug, 'contract.json');
  if (!fs.existsSync(contractFile)) continue;
  const contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
  const entry = { name: String(contract.name || slug) };
  if (Array.isArray(contract.aliases) && contract.aliases.length) {
    entry.aliases = contract.aliases.filter((alias) => SLUG.test(alias));
  }
  const logoRef = contract.assets && contract.assets.logo && contract.assets.logo.url;
  if (typeof logoRef === 'string') {
    const file = path.join(root, slug, path.basename(logoRef));
    if (fs.existsSync(file) && path.extname(file).toLowerCase() === '.svg') {
      const svg = fs.readFileSync(file, 'utf8');
      if (/<script|\son[a-z]+\s*=|javascript:/i.test(svg)) {
        skipped += 1;
      } else {
        fs.writeFileSync(path.join(outDir, `${slug}.svg`), svg);
        entry.logo = true;
        logos += 1;
      }
    }
  }
  catalog[slug] = entry;
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 1)}\n`);
console.log(`${Object.keys(catalog).length} device types, ${logos} logos, ${skipped} skipped`);

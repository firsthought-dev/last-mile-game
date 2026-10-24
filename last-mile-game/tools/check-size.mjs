// Fails when the portal ZIP is over budget.
//   node tools/check-size.mjs <zip> [--warn-mb 10] [--fail-mb 20]
import fs from 'node:fs';

const args = process.argv.slice(2);
const zip = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const opt = (name, d) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : d);
const warnMb = opt('--warn-mb', 10);
const failMb = opt('--fail-mb', 20);
if (!zip) { console.error('usage: check-size.mjs <zip> [--warn-mb N] [--fail-mb N]'); process.exit(2); }
if (!fs.existsSync(zip)) { console.error(`check-size FAIL: ${zip} not found`); process.exit(1); }

const mb = fs.statSync(zip).size / (1024 * 1024);
if (mb > failMb) { console.error(`check-size FAIL: ${mb.toFixed(1)} MB is over the ${failMb} MB limit`); process.exit(1); }
if (mb > warnMb) console.warn(`check-size WARN: ${mb.toFixed(1)} MB is over the ${warnMb} MB target`);
else console.log(`check-size OK: ${mb.toFixed(1)} MB`);

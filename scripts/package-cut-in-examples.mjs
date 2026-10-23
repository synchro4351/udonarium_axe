import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Each folder of plain XML under examples/ is packed into a zip of the same name beside it.
for (const pack of ['tyoitashi-cut-ins', 'tyoitashi-koma']) {
  const source = resolve(root, 'examples', pack);
  const destination = resolve(root, 'examples', `${pack}.zip`);
  const entries = Object.fromEntries(
    readdirSync(source)
      .filter((name) => name.endsWith('.xml'))
      .sort()
      .map((name) => [name, [new Uint8Array(readFileSync(resolve(source, name))), { mtime: new Date(2026, 9, 2) }]])
  );
  writeFileSync(destination, zipSync(entries, { level: 9 }));
  console.log(`Packaged ${Object.keys(entries).length} examples into ${pack}.zip.`);
}

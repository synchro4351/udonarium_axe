import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'examples/tyoitashi-cut-ins');
const destination = resolve(root, 'src/assets/samples/tyoitashi-cut-in-examples.zip');
const entries = Object.fromEntries(
  readdirSync(source)
    .filter((name) => name.endsWith('.xml'))
    .sort()
    .map((name) => [name, [new Uint8Array(readFileSync(resolve(source, name))), { mtime: new Date(2026, 9, 2) }]])
);
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, zipSync(entries, { level: 9 }));
console.log(`Packaged ${Object.keys(entries).length} cut-in examples.`);

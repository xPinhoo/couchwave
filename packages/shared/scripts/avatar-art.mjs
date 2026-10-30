// Turns the SVGs in assets/profile-avatars into src/avatar-art.ts, so the TV and the phones
// share one copy of each drawing. Run after adding or editing one: npm run avatars -w @couchwave/shared
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const root = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const sourceDir = join(root, 'assets', 'profile-avatars');
const target = join(root, 'packages', 'shared', 'src', 'avatar-art.ts');
const SVG_NAMESPACE = 'xmlns="http://www.w3.org/2000/svg"';

const files = readdirSync(sourceDir)
  .filter((file) => file.endsWith('.svg'))
  .sort();

const entries = files.map((file) => {
  const svg = readFileSync(join(sourceDir, file), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '')
    // The fixed size on the <svg> tag only: shapes like <rect> need theirs
    .replace(/<svg[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, ''))
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
  // Browsers only treat a file as an image when it declares exactly this namespace
  if (!svg.includes(SVG_NAMESPACE)) throw new Error(`${file}: missing ${SVG_NAMESPACE}`);
  if (/<script|\son\w+=|href=/i.test(svg))
    throw new Error(`${file}: scripts and links not allowed`);
  return `  '${basename(file, '.svg')}': '${svg.replace(/'/g, "\\'")}',`;
});

writeFileSync(
  target,
  [
    '// Generated from assets/profile-avatars by scripts/avatar-art.mjs. Do not edit by hand.',
    'export const AVATAR_ART = {',
    ...entries,
    '} as const;',
    '',
  ].join('\n'),
);
console.log(`Wrote ${files.length} avatars to ${target}`);

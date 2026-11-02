import type { ColorCategory } from './color.js';

/**
 * The pictures of Guess the Color, as small SVGs on a 300×200 canvas. Characters and brands
 * are plain original shapes named on screen, not their real artwork. The missing colour is
 * written as `C`, so these never hold the answers (those live on the server).
 */

const C = '__COLOR__';

const eyes = (y = 85, x1 = 125, x2 = 175, r = 12) =>
  `<circle cx="${x1}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x2}" cy="${y}" r="${r}" fill="#fff"/>` +
  `<circle cx="${x1 + 2}" cy="${y}" r="${r / 2.4}" fill="#1b1b1f"/><circle cx="${x2 + 2}" cy="${y}" r="${r / 2.4}" fill="#1b1b1f"/>`;
const smile = (y = 125) =>
  `<path d="M122 ${y}q28 26 56 0" fill="none" stroke="#1b1b1f" stroke-width="5" stroke-linecap="round"/>`;

// ── Characters ───────────────────────────────────────────────────────────────

const head = `<circle cx="150" cy="100" r="75" fill="${C}" stroke="#1b1b1f" stroke-width="4"/>${eyes()}${smile()}`;
const eared = `<circle cx="72" cy="100" r="16" fill="${C}" stroke="#1b1b1f" stroke-width="4"/><circle cx="228" cy="100" r="16" fill="${C}" stroke="#1b1b1f" stroke-width="4"/>${head}`;
const pointy = `<path d="M85 70L70 10l50 35zM215 70l15-60-50 35z" fill="${C}" stroke="#1b1b1f" stroke-width="4"/>${head}`;
const cap = `<path d="M70 125a80 80 0 0 1 160 0z" fill="${C}" stroke="#1b1b1f" stroke-width="4"/><path d="M60 125h195q-5 25-60 22H85q-28 0-25-22z" fill="${C}" stroke="#1b1b1f" stroke-width="4"/><circle cx="150" cy="85" r="20" fill="#fff"/>`;
const furry = `<circle cx="150" cy="100" r="78" fill="${C}" stroke="${C}" stroke-width="14" stroke-dasharray="6 7"/><circle cx="150" cy="100" r="78" fill="${C}"/>${eyes(78, 128, 172, 18)}${smile(122)}`;

const spongebob = `<rect x="70" y="20" width="160" height="160" rx="10" fill="${C}" stroke="#1b1b1f" stroke-width="4"/>${eyes(80, 125, 175, 20)}${smile(125)}`;
const patrick = `<path d="M150 8l28 66 72 6-55 47 17 70-62-37-62 37 17-70-55-47 72-6z" fill="${C}" stroke="#1b1b1f" stroke-width="4" stroke-linejoin="round"/>${eyes(88, 133, 167, 11)}`;
const pacman = `<path d="M150 100L222 60a82 82 0 1 0 0 80z" fill="${C}" stroke="#1b1b1f" stroke-width="4"/><circle cx="150" cy="55" r="8" fill="#1b1b1f"/>`;
const minion = `<rect x="95" y="15" width="110" height="175" rx="55" fill="${C}" stroke="#1b1b1f" stroke-width="4"/>${eyes(70, 128, 172, 18)}${smile(110)}<path d="M95 140h110v0q0 48-55 48t-55-48z" fill="#3e63dd"/>`;

// ── Things ───────────────────────────────────────────────────────────────────

const wheels =
  '<circle cx="85" cy="155" r="18" fill="#1b1b1f"/><circle cx="215" cy="155" r="18" fill="#1b1b1f"/>';
const windows = (y: number, x = 45, count = 6) =>
  Array.from(
    { length: count },
    (_, i) => `<rect x="${x + i * 36}" y="${y}" width="28" height="24" rx="3" fill="#d6e9f5"/>`,
  ).join('');
const schoolBus = `<rect x="30" y="50" width="240" height="105" rx="12" fill="${C}" stroke="#1b1b1f" stroke-width="3"/>${windows(65)}<rect x="30" y="105" width="240" height="6" fill="#1b1b1f"/>${wheels}`;
const doubleDecker = `<rect x="45" y="12" width="210" height="145" rx="12" fill="${C}" stroke="#1b1b1f" stroke-width="3"/>${windows(25, 58, 5)}${windows(90, 58, 5)}${wheels}`;
const car = `<path d="M25 140q0-30 35-35l40-35q8-7 20-7h60q12 0 20 7l35 35q40 5 40 35v15H25z" fill="${C}" stroke="#1b1b1f" stroke-width="3"/><path d="M112 76h34v30H82zM156 76h26l30 30h-56z" fill="#d6e9f5"/>${wheels}`;
const taxi = `${car}<rect x="125" y="42" width="50" height="20" rx="3" fill="#1b1b1f"/><text x="150" y="57" font-family="sans-serif" font-size="14" font-weight="700" text-anchor="middle" fill="#fff">TAXI</text>`;
const banana = `<path d="M55 40q10-10 18 2c10 70 75 105 165 75 12-3 15 10 5 16-100 60-210 5-188-93z" fill="${C}" stroke="#5a4a12" stroke-width="3"/>`;
const stopSign = `<path d="M108 10h84l58 58v64l-58 58h-84l-58-58V68z" fill="${C}" stroke="#fff" stroke-width="6"/><text x="150" y="118" font-family="sans-serif" font-size="52" font-weight="800" text-anchor="middle" fill="#fff">STOP</text>`;
const tennisBall = `<circle cx="150" cy="100" r="85" fill="${C}"/><path d="M85 45q50 55 0 110M215 45q-50 55 0 110" fill="none" stroke="#fff" stroke-width="7"/>`;
const bridge = `<rect width="300" height="200" fill="#cfe7f5"/><rect y="160" width="300" height="40" fill="#5b89a8"/><path d="M0 130h300" stroke="${C}" stroke-width="10"/><path d="M75 25v150M225 25v150" stroke="${C}" stroke-width="14"/><path d="M0 70Q40 130 75 30 150 190 225 30 260 130 300 70" fill="none" stroke="${C}" stroke-width="5"/>`;
const liberty = `<path d="M150 62l-34-30 22 22-10-34 16 30 6-38 6 38 16-30-10 34 22-22-34 30z" fill="${C}"/><circle cx="150" cy="78" r="22" fill="${C}"/><path d="M108 195q0-100 42-98 42-2 42 98z" fill="${C}"/><path d="M180 112l28-72 12 4-24 78z" fill="${C}"/><path d="M204 34l20 6 2-14-12-14-8 10z" fill="#f5b83d"/><rect x="88" y="190" width="124" height="10" fill="#a8a29a"/>`;
const flamingo = `<path d="M165 120q-20-40 15-65 15-12 2-28-14-12-28 2l-8-8q20-22 44-6 22 20 0 48-25 20-10 50z" fill="${C}"/><ellipse cx="125" cy="118" rx="55" ry="32" fill="${C}"/><path d="M118 148v48M138 148v48" stroke="${C}" stroke-width="5"/><path d="M146 25l-22 6 10 12z" fill="#1b1b1f"/>`;
const carrot = `<path d="M90 60q60-30 105 5L60 180z" fill="${C}"/><path d="M175 50q5-30 40-40-5 20-15 30 25-10 50 5-25 15-50 10 15 10 15 35-25-5-40-40z" fill="#3f9142"/>`;
const seeds = [
  [110, 85],
  [150, 90],
  [190, 85],
  [125, 120],
  [170, 120],
  [150, 150],
]
  .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="5" fill="#ffe9a8"/>`)
  .join('');
const strawberry = `<path d="M150 190Q45 110 70 60q30-25 80-12 50-13 80 12 25 50-80 130z" fill="${C}"/><path d="M95 50q55-40 110 0-30 5-30 25-20-20-25-5-5-15-25 5 0-20-30-25z" fill="#3f9142"/>${seeds}`;
const eggplant = `<path d="M185 45Q130 30 75 95q-40 55 5 85 50 25 95-30 45-55 10-105z" fill="${C}"/><path d="M165 45q15-25 45-30l5 12q-15 5-20 20 5 25 0 35-30-15-30-37z" fill="#3f9142"/>`;
const stickyNote = `<path d="M70 25h160v130l-30 30H70z" fill="${C}"/><path d="M200 185v-30h30z" fill="#00000030"/><path d="M90 65h120M90 95h120M90 125h80" stroke="#00000055" stroke-width="5" stroke-linecap="round"/>`;
const lemon = `<path d="M40 100q15-60 90-65 40-10 95 15 25-5 35 50-10 55-35 50-55 25-95 15-75-5-90-65z" fill="${C}" stroke="#7a6a12" stroke-width="3"/>`;

// ── Flags ────────────────────────────────────────────────────────────────────

const stripesV = (a: string, b: string, c: string) =>
  `<rect width="100" height="200" fill="${a}"/><rect x="100" width="100" height="200" fill="${b}"/><rect x="200" width="100" height="200" fill="${c}"/>`;
const stripesH = (a: string, b: string, c: string) =>
  `<rect width="300" height="67" fill="${a}"/><rect y="67" width="300" height="67" fill="${b}"/><rect y="134" width="300" height="66" fill="${c}"/>`;
const nordic = (field: string, cross: string) =>
  `<rect width="300" height="200" fill="${field}"/><rect x="85" width="36" height="200" fill="${cross}"/><rect y="82" width="300" height="36" fill="${cross}"/>`;
const japan = `<rect width="300" height="200" fill="#fff"/><circle cx="150" cy="100" r="60" fill="${C}"/>`;
const ukraine = `<rect width="300" height="100" fill="#0057b7"/><rect y="100" width="300" height="100" fill="${C}"/>`;
const switzerland = `<rect width="300" height="200" fill="${C}"/><rect x="130" y="40" width="40" height="120" fill="#fff"/><rect x="90" y="80" width="120" height="40" fill="#fff"/>`;
const greece =
  `<rect width="300" height="200" fill="#fff"/>` +
  [0, 44, 89, 133, 178]
    .map((y) => `<rect y="${y}" width="300" height="22" fill="${C}"/>`)
    .join('') +
  `<rect width="110" height="111" fill="${C}"/><rect x="44" width="22" height="111" fill="#fff"/><rect y="44" width="110" height="22" fill="#fff"/>`;
const turkey = `<rect width="300" height="200" fill="${C}"/><circle cx="115" cy="100" r="50" fill="#fff"/><circle cx="128" cy="100" r="40" fill="${C}"/><path d="M180 100l40-14-25 34V80l25 34z" fill="#fff"/>`;
const portugal = `<rect width="120" height="200" fill="${C}"/><rect x="120" width="180" height="200" fill="#ff0000"/><circle cx="120" cy="100" r="42" fill="#ffe000"/><circle cx="120" cy="100" r="22" fill="#fff"/>`;
const brazil = `<rect width="300" height="200" fill="${C}"/><path d="M150 22l125 78-125 78L25 100z" fill="#ffdf00"/><circle cx="150" cy="100" r="42" fill="#002776"/>`;

// ── Brands ───────────────────────────────────────────────────────────────────

const can = `<path d="M105 30h90l10 15v115l-10 15h-90l-10-15V45z" fill="${C}" stroke="#555" stroke-width="3"/><path d="M95 95q55-30 110 0v12q-55-30-110 0z" fill="#fff"/><ellipse cx="150" cy="30" rx="45" ry="6" fill="#c9c9c9"/>`;
const coffee = `<path d="M95 45h110l-14 145h-82z" fill="#fff" stroke="#555" stroke-width="3"/><rect x="88" y="25" width="124" height="22" rx="4" fill="${C}"/><circle cx="150" cy="115" r="35" fill="${C}"/>`;
const appIcon = (inner: string) =>
  `<rect x="60" y="10" width="180" height="180" rx="36" fill="${C}"/>${inner}`;
const musicNote = appIcon(
  `<path d="M135 145V60l60-15v85" fill="none" stroke="#fff" stroke-width="10"/><ellipse cx="120" cy="146" rx="18" ry="13" fill="#fff"/><ellipse cx="180" cy="131" rx="18" ry="13" fill="#fff"/>`,
);
const person = appIcon(
  `<circle cx="150" cy="80" r="26" fill="#fff"/><path d="M100 160q5-50 50-50t50 50z" fill="#fff"/>`,
);
const film = appIcon(
  `<rect x="110" y="55" width="80" height="90" rx="6" fill="#fff"/><path d="M135 80l35 20-35 20z" fill="${C}"/>`,
);
const screen = appIcon(
  `<rect x="105" y="60" width="90" height="80" fill="#fff"/><rect x="125" y="80" width="12" height="35" fill="${C}"/><rect x="163" y="80" width="12" height="35" fill="${C}"/>`,
);
const playButton = `<rect x="35" y="35" width="230" height="130" rx="36" fill="${C}"/><path d="M125 70l60 30-60 30z" fill="#fff"/>`;
const friesBox = `${[90, 110, 130, 150, 170, 190]
  .map(
    (x, i) =>
      `<rect x="${x}" y="${25 + (i % 3) * 12}" width="14" height="100" rx="3" fill="#f6c945"/>`,
  )
  .join('')}<path d="M75 80q75 30 150 0l-20 110H95z" fill="${C}"/>`;
const store = `<rect x="30" y="70" width="240" height="110" fill="${C}"/><rect x="100" y="40" width="100" height="40" fill="#ffdb00"/><rect x="125" y="125" width="50" height="55" fill="#d6e9f5"/>`;
const giftBox = `<rect x="55" y="70" width="190" height="115" rx="4" fill="${C}"/><rect x="45" y="50" width="210" height="35" rx="4" fill="${C}" stroke="#00000022" stroke-width="2"/><rect x="138" y="50" width="24" height="135" fill="#fff"/><path d="M150 50q-50-40-55-10t55 10q50 20 55-10t-55 10z" fill="#fff"/>`;
const chocolate = `<path d="M25 55h250v90H25z" fill="${C}"/><rect x="25" y="55" width="50" height="90" fill="#d7d7d7"/><rect x="225" y="55" width="50" height="90" fill="#d7d7d7"/>`;
const van = `<path d="M30 45h170l60 55v55H30z" fill="${C}" stroke="#1b1b1f" stroke-width="3"/><path d="M205 58l40 42h-40z" fill="#d6e9f5"/>${wheels}`;
const heart = `<path d="M150 180Q40 110 60 55q25-40 90 5 65-45 90-5 20 55-90 125z" fill="${C}"/>`;
const bubble = `<path d="M150 25a75 75 0 0 1 0 150q-20 0-38-8l-42 12 13-38a75 75 0 0 1 67-116z" fill="${C}"/><path d="M122 80q5 45 55 55l10-18-18-10-10 8q-12-8-17-20l8-10-10-18z" fill="#fff"/>`;

export interface ColorPuzzle {
  id: string;
  /** What's on the TV, e.g. "Mario's cap". */
  name: string;
  category: Exclude<ColorCategory, 'mix'>;
  art: string;
}

const puzzles = (
  category: ColorPuzzle['category'],
  items: readonly (readonly [id: string, name: string, art: string])[],
): ColorPuzzle[] => items.map(([id, name, art]) => ({ id, name, category, art }));

export const COLOR_PUZZLES: readonly ColorPuzzle[] = [
  ...puzzles('characters', [
    ['mario', "Mario's cap", cap],
    ['luigi', "Luigi's cap", cap],
    ['homer', "Homer Simpson's skin", head],
    ['shrek', "Shrek's skin", eared],
    ['smurf', "A Smurf's skin", eared],
    ['hulk', "The Hulk's skin", head],
    ['grinch', "The Grinch's fur", furry],
    ['kermit', 'Kermit the Frog', head],
    ['yoda', "Yoda's skin", eared],
    ['elmo', "Elmo's fur", furry],
    ['cookie', "Cookie Monster's fur", furry],
    ['sonic', "Sonic's fur", pointy],
    ['pikachu', "Pikachu's fur", pointy],
    ['panther', "The Pink Panther's fur", pointy],
    ['spongebob', 'SpongeBob', spongebob],
    ['patrick', 'Patrick Star', patrick],
    ['pacman', 'Pac-Man', pacman],
    ['minion', 'A Minion', minion],
  ]),
  ...puzzles('things', [
    ['banana', 'A ripe banana', banana],
    ['stop', 'A stop sign', stopSign],
    ['schoolbus', 'An American school bus', schoolBus],
    ['tennis', 'A tennis ball', tennisBall],
    ['goldengate', 'The Golden Gate Bridge', bridge],
    ['liberty', 'The Statue of Liberty', liberty],
    ['londonbus', 'A London bus', doubleDecker],
    ['nytaxi', 'A New York taxi', taxi],
    ['ferrari', 'A Ferrari', car],
    ['flamingo', 'A flamingo', flamingo],
    ['carrot', 'A carrot', carrot],
    ['strawberry', 'A strawberry', strawberry],
    ['eggplant', 'An eggplant', eggplant],
    ['sticky', 'A classic sticky note', stickyNote],
    ['lemon', 'A lemon', lemon],
  ]),
  ...puzzles('flags', [
    ['japan', "Japan's flag", japan],
    ['italy', "Italy's flag", stripesV(C, '#fff', '#cd212a')],
    ['ireland', "Ireland's flag", stripesV('#169b62', '#fff', C)],
    ['france', "France's flag", stripesV(C, '#fff', '#e1000f')],
    ['germany', "Germany's flag", stripesH('#000', '#dd0000', C)],
    ['netherlands', 'The flag of the Netherlands', stripesH('#ae1c28', '#fff', C)],
    ['ukraine', "Ukraine's flag", ukraine],
    ['sweden', "Sweden's flag", nordic(C, '#fecc00')],
    ['finland', "Finland's flag", nordic('#fff', C)],
    ['denmark', "Denmark's flag", nordic(C, '#fff')],
    ['switzerland', "Switzerland's flag", switzerland],
    ['greece', "Greece's flag", greece],
    ['turkey', "Türkiye's flag", turkey],
    ['portugal', "Portugal's flag", portugal],
    ['brazil', "Brazil's flag", brazil],
  ]),
  ...puzzles('brands', [
    ['coke', 'A Coca-Cola can', can],
    ['starbucks', 'A Starbucks cup', coffee],
    ['spotify', "Spotify's app", musicNote],
    ['facebook', "Facebook's app", person],
    ['netflix', "Netflix's app", film],
    ['youtube', "YouTube's play button", playButton],
    ['twitch', "Twitch's app", screen],
    ['whatsapp', "WhatsApp's app", bubble],
    ['mcdonalds', "McDonald's fries box", friesBox],
    ['ikea', 'An IKEA store', store],
    ['tiffany', 'A Tiffany & Co. box', giftBox],
    ['cadbury', 'A Cadbury chocolate bar', chocolate],
    ['milka', 'A Milka chocolate bar', chocolate],
    ['ups', 'A UPS van', van],
    ['barbie', "Barbie's signature colour", heart],
  ]),
];

export function colorPuzzle(id: string): ColorPuzzle | undefined {
  return COLOR_PUZZLES.find((item) => item.id === id);
}

/**
 * The picture as a URL an <img> can show. `color` fills the missing part; without one
 * it stays a grey checker pattern, like the empty area in a paint program.
 */
export function colorArtUrl(puzzle: ColorPuzzle, color: string | null): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200">' +
    '<defs><pattern id="hidden" width="20" height="20" patternUnits="userSpaceOnUse">' +
    '<rect width="20" height="20" fill="#d9d9d9"/><rect width="10" height="10" fill="#9a9a9a"/>' +
    '<rect x="10" y="10" width="10" height="10" fill="#9a9a9a"/></pattern></defs>' +
    `${puzzle.art.replaceAll(C, color ?? 'url(#hidden)')}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

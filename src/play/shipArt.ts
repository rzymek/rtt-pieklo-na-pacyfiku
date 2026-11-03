// Ships seen from above, in their wartime paint: the Allies in Measure 21 navy blue with a deck-blue
// flight deck, the Japanese in Kure grey with bare wooden flight decks and linoleum decks.
// Drawn along the x axis, bow towards +x, centered on 0; starboard is +y.

interface Paint {
  hull: string
  deck: string
  flightDeck: string
  superstructure: string
  turret: string
}

const PAINT: Paint[] = [
  {hull: '#3a4651', deck: '#58626d', flightDeck: '#66707b', superstructure: '#7d8893', turret: '#6c7782'},
  {hull: '#7f868a', deck: '#7a5236', flightDeck: '#c29b63', superstructure: '#a3a9ac', turret: '#90979b'},
]

const DARK = '#22272b'

type Kind = 'carrier' | 'flushCarrier' | 'battleship' | 'cruiser' | 'destroyer' | 'transport'

const KINDS: Record<string, Kind> = {
  BUNKER_HILL: 'carrier',
  LEXINGTON: 'carrier',
  YORKTOWN: 'carrier',
  HIYO: 'carrier',
  KAGA: 'carrier',
  // Shoho, a converted submarine tender, had no island.
  SHOHO: 'flushCarrier',
  PANCERNIK: 'battleship',
  KRAZOWNIK: 'cruiser',
  NISZCZYCIEL: 'destroyer',
  TRANSPORTOWIEC: 'transport',
}

// Half the beam, in map pixels (a hex is about 28 across).
const HALF_BEAM: Record<Kind, number> = {
  carrier: 6.5, flushCarrier: 5.5, battleship: 5.5, cruiser: 4, destroyer: 3, transport: 4.5,
}

// Kana painted on the after end of the flight deck, as on Japanese carriers.
const DECK_KANA: Record<string, string> = {KAGA: 'カ'}

export function halfBeam(type: string): number {
  return HALF_BEAM[KINDS[type] ?? 'cruiser']
}

const f = (n: number) => n.toFixed(2)

function hullPath(h: number, w: number, blunt = false): string {
  const shoulder = blunt ? 0.7 : 0.4
  const stem = blunt ? 0.35 : 0
  return `M${f(-h)} ${f(-w * 0.7)} Q${f(-h)} ${f(-w)} ${f(-h * 0.8)} ${f(-w)} L${f(h * shoulder)} ${f(-w)} `
    + `Q${f(h * 0.92)} ${f(-w * 0.95)} ${f(h)} ${f(-w * stem)} L${f(h)} ${f(w * stem)} `
    + `Q${f(h * 0.92)} ${f(w * 0.95)} ${f(h * shoulder)} ${f(w)} L${f(-h * 0.8)} ${f(w)} Q${f(-h)} ${f(w)} ${f(-h)} ${f(w * 0.7)}Z`
}

// A gun turret at x, its barrels pointing forward (direction 1) or aft (-1).
function turret(p: Paint, x: number, r: number, direction: 1 | -1, barrels = 2): string {
  const length = r * 2.3
  const lines = Array.from({length: barrels}, (_, i) => {
    const y = (i - (barrels - 1) / 2) * r * 0.55
    return `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x + direction * length)}" y2="${f(y)}"/>`
  }).join('')
  return `<g stroke="${DARK}" stroke-width="${f(r * 0.28)}" stroke-linecap="round">${lines}</g>`
    + `<rect x="${f(x - r)}" y="${f(-r)}" width="${f(r * 2)}" height="${f(r * 2)}" rx="${f(r * 0.7)}" `
    + `fill="${p.turret}" stroke="${DARK}" stroke-width=".35"/>`
}

function funnel(x: number, w: number, l = w * 1.6): string {
  return `<rect x="${f(x - l / 2)}" y="${f(-w / 2)}" width="${f(l)}" height="${f(w)}" rx="${f(w / 2)}" `
    + `fill="${DARK}" stroke="#555" stroke-width=".3"/>`
}

function superstructure(p: Paint, from: number, to: number, w: number): string {
  return `<rect x="${f(from)}" y="${f(-w)}" width="${f(to - from)}" height="${f(w * 2)}" rx="${f(w * 0.4)}" `
    + `fill="${p.superstructure}" stroke="${DARK}" stroke-width=".35"/>`
}

function deck(p: Paint, h: number, w: number, blunt = false): string {
  return `<path d="${hullPath(h * 0.95, w * 0.82, blunt)}" fill="${p.deck}"/>`
}

function carrier(p: Paint, type: string, h: number, w: number, island: boolean): string {
  const from = -h * 0.97, to = h * 0.84, half = w * 0.92
  const flightDeck = `<rect x="${f(from)}" y="${f(-half)}" width="${f(to - from)}" height="${f(half * 2)}" rx="1" `
    + `fill="${p.flightDeck}" stroke="${DARK}" stroke-width=".4"/>`
  // Elevators, and the deck markings: the centerline and the stripes across both ends.
  const elevators = [-0.5, 0.05, 0.55].map(at => {
    const s = w * 0.7
    return `<rect x="${f(h * at - s / 2)}" y="${f(-s / 2)}" width="${f(s)}" height="${f(s)}" fill="${DARK}" fill-opacity=".35"/>`
  }).join('')
  const markings = `<g stroke="white" stroke-opacity=".85" stroke-width=".45" fill="none">`
    + `<line x1="${f(from + 3)}" y1="0" x2="${f(to - 3)}" y2="0" stroke-dasharray="2.5 2"/>`
    + `<line x1="${f(from + 1.5)}" y1="${f(-half + 0.7)}" x2="${f(from + 1.5)}" y2="${f(half - 0.7)}"/>`
    + `<line x1="${f(to - 1.5)}" y1="${f(-half + 0.7)}" x2="${f(to - 1.5)}" y2="${f(half - 0.7)}"/>`
    + `</g>`
  const kana = DECK_KANA[type]
    ? `<text transform="translate(${f(from + 6)} 0) rotate(90)" text-anchor="middle" dominant-baseline="central" `
    + `font-size="${f(w * 0.95)}" font-weight="bold" fill="white" fill-opacity=".9">${DECK_KANA[type]}</text>`
    : ''
  const islandArt = island
    ? `<rect x="${f(h * 0.08)}" y="${f(half - 1.6)}" width="${f(h * 0.2)}" height="3.6" rx=".8" `
    + `fill="${p.superstructure}" stroke="${DARK}" stroke-width=".35"/>`
    + `<rect x="${f(h * 0.12)}" y="${f(half - 1)}" width="${f(h * 0.08)}" height="2.4" rx="1" fill="${DARK}"/>`
    : ''
  return flightDeck + elevators + markings + kana + islandArt
}

function battleship(p: Paint, h: number, w: number): string {
  return deck(p, h, w)
    + turret(p, h * 0.52, w * 0.45, 1, 3)
    + superstructure(p, -h * 0.18, h * 0.28, w * 0.45)
    + funnel(-h * 0.02, w * 0.45)
    + turret(p, h * 0.36, w * 0.48, 1, 3)
    + turret(p, -h * 0.45, w * 0.48, -1, 3)
}

function cruiser(p: Paint, h: number, w: number): string {
  return deck(p, h, w)
    + turret(p, h * 0.58, w * 0.42, 1)
    + superstructure(p, -h * 0.25, h * 0.3, w * 0.42)
    + funnel(h * 0.12, w * 0.4)
    + funnel(-h * 0.08, w * 0.4)
    + turret(p, h * 0.4, w * 0.45, 1)
    + turret(p, -h * 0.52, w * 0.45, -1)
}

function destroyer(p: Paint, h: number, w: number): string {
  const tubes = [-0.3, -0.05].map(at =>
    `<rect x="${f(h * at - 1.2)}" y="${f(-w * 0.35)}" width="2.4" height="${f(w * 0.7)}" rx=".4" fill="${p.turret}" stroke="${DARK}" stroke-width=".3"/>`).join('')
  return deck(p, h, w)
    + turret(p, h * 0.62, w * 0.5, 1, 1)
    + superstructure(p, h * 0.25, h * 0.48, w * 0.45)
    + funnel(h * 0.12, w * 0.45)
    + tubes
    + turret(p, -h * 0.62, w * 0.5, -1, 1)
}

function transport(p: Paint, h: number, w: number): string {
  const hatches = [-0.65, -0.35, 0.35, 0.65].map(at =>
    `<rect x="${f(h * at - 2)}" y="${f(-w * 0.45)}" width="4" height="${f(w * 0.9)}" fill="#4a3b2c" stroke="${DARK}" stroke-width=".3"/>`).join('')
  const kingposts = [-0.5, 0.5].map(at =>
    `<line x1="${f(h * at)}" y1="${f(-w * 0.8)}" x2="${f(h * at)}" y2="${f(w * 0.8)}" stroke="${DARK}" stroke-width=".4"/>`).join('')
  return deck(p, h, w, true) + hatches + kingposts
    + superstructure(p, -h * 0.15, h * 0.15, w * 0.6)
    + funnel(-h * 0.03, w * 0.55, w * 0.7)
}

// Burnt patches for the damage taken, a quarter of the endurance each.
function damageMarks(h: number, w: number, damaged: number): string {
  const count = Math.ceil(Math.min(1, damaged) * 4)
  return Array.from({length: count}, (_, i) => {
    const x = h * [0.3, -0.35, 0.65, -0.7][i], y = w * [0.25, -0.3, -0.15, 0.2][i]
    return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(w * 0.7)}" ry="${f(w * 0.45)}" fill="#111" fill-opacity=".6"/>`
      + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(w * 0.18)}" fill="#ff7a1a" fill-opacity=".9"/>`
  }).join('')
}

// halfLength: from the middle to the stem; damaged: the part of the endurance lost.
export function shipArt(type: string, side: number, halfLength: number, damaged: number): string {
  const kind = KINDS[type] ?? 'cruiser'
  const p = PAINT[side] ?? PAINT[0]
  const h = halfLength, w = HALF_BEAM[kind]
  const blunt = kind === 'transport'
  const outline = hullPath(h, w, blunt)
  const foam = `<path d="${outline}" fill="none" stroke="white" stroke-opacity=".35" stroke-width="2.4" stroke-linejoin="round"/>`
  const hull = `<path d="${outline}" fill="${p.hull}" stroke="${DARK}" stroke-width=".5"/>`
  const details = {
    carrier: () => carrier(p, type, h, w, true),
    flushCarrier: () => carrier(p, type, h, w, false),
    battleship: () => battleship(p, h, w),
    cruiser: () => cruiser(p, h, w),
    destroyer: () => destroyer(p, h, w),
    transport: () => transport(p, h, w),
  }[kind]()
  return foam + hull + details + damageMarks(h, w, damaged)
}

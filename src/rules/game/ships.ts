import {DIR_OFFSETS, hexDistance, hexId, hexStep, parseHex} from "@rzymek/rally-the-troops-module/rules";

export interface ShipType {
  nazwa: string
  wytrzymalosc: number
  // 6.3.6: [normal, once the damage is over half the endurance]
  lekkie: [number, number]
  ciezkie: [number, number]
  dlugosc: number
}

// Table 3
export const SHIP_TYPES = {
  BUNKER_HILL: {nazwa: "Lotniskowiec Bunker Hill", wytrzymalosc: 18, lekkie: [3, 2], ciezkie: [4, 2], dlugosc: 5},
  LEXINGTON: {nazwa: "Lotniskowiec Lexington", wytrzymalosc: 18, lekkie: [2, 1], ciezkie: [1, 0], dlugosc: 5},
  YORKTOWN: {nazwa: "Lotniskowiec Yorktown", wytrzymalosc: 14, lekkie: [2, 1], ciezkie: [3, 1], dlugosc: 5},
  HIYO: {nazwa: "Lotniskowiec Hiyo", wytrzymalosc: 17, lekkie: [5, 2], ciezkie: [2, 1], dlugosc: 5},
  KAGA: {nazwa: "Lotniskowiec Kaga", wytrzymalosc: 20, lekkie: [3, 1], ciezkie: [2, 1], dlugosc: 5},
  SHOHO: {nazwa: "Lekki lotniskowiec Shoho", wytrzymalosc: 12, lekkie: [1, 0], ciezkie: [3, 1], dlugosc: 4},
  PANCERNIK: {nazwa: "Pancernik", wytrzymalosc: 26, lekkie: [4, 2], ciezkie: [6, 3], dlugosc: 4},
  KRAZOWNIK: {nazwa: "Krążownik", wytrzymalosc: 12, lekkie: [1, 0], ciezkie: [1, 0], dlugosc: 2},
  NISZCZYCIEL: {nazwa: "Niszczyciel", wytrzymalosc: 7, lekkie: [1, 0], ciezkie: [1, 0], dlugosc: 2},
  TRANSPORTOWIEC: {nazwa: "Statek transportowy", wytrzymalosc: 10, lekkie: [0, 0], ciezkie: [0, 0], dlugosc: 3},
} satisfies Record<string, ShipType>

export type ShipKey = keyof typeof SHIP_TYPES

export interface Ship {
  id: string
  side: number
  type: ShipKey
  // A name of the ship in the scenario, if the type has none.
  nazwa: string
  hexes: string[]
  damage?: number
  // 2.3
  sunk?: boolean
}

// The direction from one hex towards another, the closest of the six.
function directionTowards(from: string, to: string): number {
  const distance = hexDistance(from, to)
  const [a, b] = parseHex(from) as [number, number]
  const missBy = (direction: number) => {
    const [da, db] = DIR_OFFSETS[direction]
    return hexDistance(hexId(a + da * distance, b + db * distance), to)
  }
  return [0, 1, 2, 3, 4, 5].reduce((best, it) => missBy(it) < missBy(best) ? it : best)
}

// 9: the scenario places a ship from one hex towards another; its length comes from table 3.
export function shipHexes(from: string, towards: string, length: number): string[] {
  const direction = directionTowards(from, towards)
  const hexes = [from]
  while (hexes.length < length) hexes.push(hexStep(hexes[hexes.length - 1], direction)!)
  return hexes
}

export function shipType(ship: Ship): ShipType {
  return SHIP_TYPES[ship.type]
}

// 6.3.6: fewer guns once the damage is over half the endurance.
export function isBadlyDamaged(ship: Ship): boolean {
  return (ship.damage ?? 0) * 2 > shipType(ship).wytrzymalosc
}

export function shipGunCount(ship: Ship): { light: number, heavy: number } {
  if (ship.sunk) return {light: 0, heavy: 0}
  const index = isBadlyDamaged(ship) ? 1 : 0
  return {light: shipType(ship).lekkie[index], heavy: shipType(ship).ciezkie[index]}
}

// 2.3
export function damageShip(ship: Ship, damage: number): string {
  const endurance = shipType(ship).wytrzymalosc
  ship.damage = Math.min(endurance, (ship.damage ?? 0) + damage)
  if (ship.damage >= endurance) {
    ship.sunk = true
    return `${ship.nazwa} zatopiony`
  }
  return `${ship.nazwa}: uszkodzenia ${ship.damage}/${endurance}`
}

export function shipAt(ships: Ship[], hex: string): Ship | undefined {
  return ships.find(ship => !ship.sunk && ship.hexes.includes(hex))
}

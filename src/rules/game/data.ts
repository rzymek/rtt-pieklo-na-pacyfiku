// 2.1.1: the stats printed on the reverse of the counter, used once the plane is badly damaged.
export interface PlaneReducedStats {
	predkosc_max: number
	predkosc_min: number
	zwrotnosc: number
	sila_ataku: number
	// 5.0.6: firing to the rear.
	sila_ataku_tyl: number
}

export interface PlaneData extends PlaneReducedStats {
	nazwa: string
	// 7.0: bombs, or a torpedo, for this many attacks in the whole game.
	udzwig_bomb: number | null
	// 2.2
	wytrzymalosc: number
	// 7.1.2
	nurkowy?: boolean
	// 7.3: can carry a torpedo,
	torpedowy?: boolean
	// and does carry one in the scenario (9).
	torpeda?: boolean
	// Table 2: the counters in the box.
	zetony: number
	img: string
	reduced: PlaneReducedStats
}

type Stats = [max: number, min: number, zwrotnosc: number, atak: number, atak_tyl: number]

function stats([predkosc_max, predkosc_min, zwrotnosc, sila_ataku, sila_ataku_tyl]: Stats): PlaneReducedStats {
	return {predkosc_max, predkosc_min, zwrotnosc, sila_ataku, sila_ataku_tyl}
}

function plane(key: string, nazwa: string, front: Stats, back: Stats, udzwig_bomb: number | null, wytrzymalosc: number,
               zetony: number, kind: { nurkowy?: boolean, torpedowy?: boolean } = {}): PlaneData {
	return {nazwa, ...stats(front), udzwig_bomb, wytrzymalosc, ...kind, zetony, img: `planes/${key}`, reduced: stats(back)}
}

const DIVE = {nurkowy: true}
const TORPEDO = {torpedowy: true}

// Table 2, with the reverse sides read off the counters.
export const data: { planes: Record<string, PlaneData> } = {
	planes: {
		A6M: plane("A6M", "A6M Zero", [6, 1, 0, 4, 0], [5, 2, 1, 3, 0], null, 4, 12),
		A6M6: plane("A6M6", "A6M6 Zero", [6, 2, 0, 4, 0], [5, 2, 1, 3, 0], null, 6, 8),
		D3A: plane("D3A", "D3A Val", [4, 2, 1, 2, 1], [3, 3, 2, 1, 0], 1, 4, 12, DIVE),
		D4Y: plane("D4Y", "D4Y1 Judy", [5, 2, 1, 2, 1], [4, 2, 2, 1, 0], 1, 4, 12, DIVE),
		B5N: plane("B5N", "B5N Kate", [4, 3, 2, 0, 1], [3, 3, 2, 0, 0], 1, 4, 12, TORPEDO),
		B6N: plane("B6N", "B6N Jill", [4, 3, 2, 1, 1], [3, 3, 2, 0, 0], 1, 5, 12, TORPEDO),
		G4M: plane("G4M", "G4M Betty", [4, 3, 3, 2, 2], [4, 4, 3, 1, 1], 2, 3, 12, TORPEDO),
		P1Y: plane("P1Y", "P1Y1 Frances", [5, 3, 2, 1, 1], [4, 3, 2, 0, 0], 2, 5, 12, TORPEDO),

		F4F: plane("F4F", "F4F Wildcat", [6, 2, 1, 4, 0], [5, 2, 2, 3, 0], null, 6, 8),
		P39: plane("P39", "P-39 Airacobra", [7, 2, 1, 3, 0], [6, 2, 2, 2, 0], null, 6, 4),
		F6F: plane("F6F", "F6F Hellcat", [6, 2, 1, 4, 0], [5, 2, 2, 3, 0], null, 7, 12),
		F4U: plane("F4U", "F4U Corsair", [7, 2, 0, 4, 0], [6, 2, 1, 3, 0], null, 7, 12),
		SBD: plane("SBD", "SBD Dauntless", [4, 3, 2, 2, 1], [3, 3, 2, 1, 0], 1, 6, 12, DIVE),
		SB2C: plane("SB2C", "SB2C Helldiver", [4, 3, 2, 2, 1], [4, 3, 2, 2, 1], 1, 6, 12, DIVE),
		TBD: plane("TBD", "TBD Devastator", [3, 3, 2, 1, 1], [3, 3, 2, 1, 1], 1, 5, 12, TORPEDO),
		TBF: plane("TBF", "TBF Avenger", [4, 3, 2, 1, 1], [3, 3, 2, 0, 0], 1, 6, 12, TORPEDO),
		B25: plane("B25", "B-25 Mitchell", [5, 3, 3, 2, 3], [4, 3, 3, 1, 2], 3, 6, 4),
		B17: plane("B17", "B-17 Flying Fortress", [6, 4, 3, 3, 3], [5, 4, 3, 2, 2], 6, 6, 8),
	}
}

import {shipsLayer} from "./refs/shipsLayer";
import {getHexCenterInSVGCoords} from "./svg/getHexCenterInSVGCoords";
import {svgNS} from "@rzymek/rally-the-troops-module/client";
import {shipArt} from "./shipArt";

// The side's colours, as on the counters: blue for the Americans, red for the Japanese.
const SIDE_COLORS = ['#1b2ab0', '#b00000']

// How far the hull reaches past the centers of its end hexes.
const HULL_OVERHANG = 11

// 2.3, 6.1.4: a ship along its hexes, with its name and the damage taken.
export function drawShips() {
  shipsLayer.innerHTML = ""
  for (const ship of view.ships ?? []) {
    if (ship.sunk) continue
    const centers = ship.hexes.map(getHexCenterInSVGCoords)
    const stern = centers[0], bow = centers[centers.length - 1]
    const mid = new DOMPoint((stern.x + bow.x) / 2, (stern.y + bow.y) / 2)
    const length = Math.hypot(bow.x - stern.x, bow.y - stern.y)
    const angle = Math.atan2(bow.y - stern.y, bow.x - stern.x)
    const halfLength = length / 2 + HULL_OVERHANG

    const art = document.createElementNS(svgNS, 'g')
    art.setAttribute('transform', `translate(${mid.x} ${mid.y}) rotate(${angle * 180 / Math.PI})`)
    art.innerHTML = shipArt(ship.type, ship.side, halfLength, (ship.damage ?? 0) / ship.wytrzymalosc)
    shipsLayer.appendChild(art)

    // The name past the stern, out of the way of the guns on the hull.
    const at = new DOMPoint(
      mid.x - Math.cos(angle) * (halfLength + 7),
      mid.y - Math.sin(angle) * (halfLength + 7),
    )
    shipsLayer.appendChild(nameplate(at, ship.side, `${ship.nazwa} ${ship.wytrzymalosc - (ship.damage ?? 0)}/${ship.wytrzymalosc}`))
  }
}

function nameplate(at: DOMPoint, side: number, text: string): SVGElement {
  const group = document.createElementNS(svgNS, 'g')
  const label = document.createElementNS(svgNS, 'text')
  label.setAttribute('x', String(at.x))
  label.setAttribute('y', String(at.y + 1.8))
  label.setAttribute('text-anchor', 'middle')
  label.setAttribute('font-family', 'Georgia, "Times New Roman", serif')
  label.setAttribute('font-weight', 'bold')
  label.setAttribute('font-size', '5')
  label.setAttribute('fill', 'white')
  label.textContent = text
  group.appendChild(label)
  shipsLayer.appendChild(group)
  // The plate is sized to the text, so the text has to be laid out first.
  const box = label.getBBox()
  group.remove()
  const plate = document.createElementNS(svgNS, 'rect')
  plate.setAttribute('x', String(box.x - 2))
  plate.setAttribute('y', String(box.y - 0.8))
  plate.setAttribute('width', String(box.width + 4))
  plate.setAttribute('height', String(box.height + 1.6))
  plate.setAttribute('rx', '1.5')
  plate.setAttribute('fill', SIDE_COLORS[side] ?? SIDE_COLORS[0])
  plate.setAttribute('fill-opacity', '.85')
  plate.setAttribute('stroke', 'white')
  plate.setAttribute('stroke-width', '.4')
  group.insertBefore(plate, label)
  return group
}

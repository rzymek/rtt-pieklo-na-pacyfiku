import {shipsLayer} from "./refs/shipsLayer";
import {getHexCenterInSVGCoords} from "./svg/getHexCenterInSVGCoords";
import {svgNS} from "@rzymek/rally-the-troops-module/client";

// Blue for the Americans, red for the Japanese (indexed by side), as on the counters.
const COLORS = ['#1b2ab0', '#d00000']

// 2.3, 6.1.4: a ship along its hexes, with its name and the damage taken.
export function drawShips() {
  shipsLayer.innerHTML = ""
  for (const ship of view.ships ?? []) {
    if (ship.sunk) continue
    const centers = ship.hexes.map(getHexCenterInSVGCoords)
    const hull = document.createElementNS(svgNS, 'polyline')
    hull.setAttribute('points', centers.map(it => `${it.x},${it.y}`).join(' '))
    hull.setAttribute('fill', 'none')
    hull.setAttribute('stroke', COLORS[ship.side])
    hull.setAttribute('stroke-width', '14')
    hull.setAttribute('stroke-linecap', 'round')
    hull.setAttribute('stroke-opacity', '.75')
    shipsLayer.appendChild(hull)

    const middle = centers[Math.floor(centers.length / 2)]
    const label = document.createElementNS(svgNS, 'text')
    label.setAttribute('x', String(middle.x))
    label.setAttribute('y', String(middle.y + 2))
    label.setAttribute('text-anchor', 'middle')
    label.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
    label.setAttribute('font-weight', 'bold')
    label.setAttribute('font-size', '6')
    label.setAttribute('fill', 'white')
    label.textContent = `${ship.nazwa} ${ship.wytrzymalosc - (ship.damage ?? 0)}/${ship.wytrzymalosc}`
    shipsLayer.appendChild(label)
  }
}

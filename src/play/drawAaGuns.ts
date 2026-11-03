import {aaGunsLayer} from "./refs/aaGunsLayer";
import {clickableAaGunsLayer} from "./refs/clickableAaGunsLayer";
import {getHexCenterInSVGCoords} from "./svg/getHexCenterInSVGCoords";
import {svgNS} from "@rzymek/rally-the-troops-module/client";

const MARKER_WIDTH = 12
const MARKER_HEIGHT = MARKER_WIDTH * 77 / 88

// In the corner of the hex, not to cover a plane above the gun.
export function drawAaGuns() {
  aaGunsLayer.innerHTML = ""
  clickableAaGunsLayer.innerHTML = ""
  // A ship's guns spread along its hexes, two to a hex.
  const shared = new Map<string, number>()
  for (const {id, heavy, hexes} of view.aa_guns ?? []) {
    const key = hexes.join()
    const index = shared.get(key) ?? 0
    shared.set(key, index + 1)
    const hex = hexes[Math.floor(index / 2) % hexes.length]
    const center = getHexCenterInSVGCoords(hex)
    const x = center.x + (index % 2 === 0 ? 1 : -1 - MARKER_WIDTH), y = center.y + 1
    const marker = document.createElementNS(svgNS, 'image')
    marker.setAttribute('href', './images/m_antia.png')
    marker.setAttribute('x', String(x))
    marker.setAttribute('y', String(y))
    marker.setAttribute('width', String(MARKER_WIDTH))
    marker.setAttribute('height', String(MARKER_HEIGHT))
    if (view.aa_fired?.includes(id)) marker.setAttribute('opacity', '0.55')
    // 6.0.1, 6.0.2
    const label = document.createElementNS(svgNS, 'text')
    label.setAttribute('x', String(x + MARKER_WIDTH))
    label.setAttribute('y', String(y + MARKER_HEIGHT))
    label.setAttribute('font-size', '5')
    label.setAttribute('font-weight', 'bold')
    label.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
    label.setAttribute('fill', heavy ? '#c80000' : 'black')
    label.setAttribute('stroke', 'white')
    label.setAttribute('stroke-width', '.3')
    label.textContent = heavy ? 'C' : 'L'
    label.style.pointerEvents = 'none'

    const isSelected = id === view.selected_gun
    const isSelectable = view.actions?.select_gun?.includes(id)
    if (isSelected || isSelectable) {
      const ring = document.createElementNS(svgNS, 'rect')
      ring.setAttribute('x', String(x))
      ring.setAttribute('y', String(y))
      ring.setAttribute('width', String(MARKER_WIDTH))
      ring.setAttribute('height', String(MARKER_HEIGHT))
      ring.setAttribute('fill', 'none')
      ring.setAttribute('stroke', isSelected ? 'blue' : 'red')
      ring.style.pointerEvents = 'none'
      clickableAaGunsLayer.appendChild(ring)
      marker.style.cursor = 'pointer'
      marker.addEventListener('click', e => {
        e.stopPropagation()
        send_action("select_gun", id)
      })
      clickableAaGunsLayer.appendChild(marker)
      clickableAaGunsLayer.appendChild(label)
    } else {
      marker.style.pointerEvents = 'none'
      aaGunsLayer.appendChild(marker)
      aaGunsLayer.appendChild(label)
    }
  }
}

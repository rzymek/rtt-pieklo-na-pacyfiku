import {ViewPlaneInstance} from "../shared/view";
import {getHexCenterInSVGCoords} from "./svg/getHexCenterInSVGCoords";
import {planePlaceholder} from "./refs/planePlaceholder";
import {NS_XLINK, svgNS} from "@rzymek/rally-the-troops-module/client";
import jammedSvg from "./markers/jammed.svg?raw";
import {createSvgMarkerAt} from "@rzymek/rally-the-troops-module/client";

// Counter artwork size; the overlays below are drawn in its pixels.
const ART_SIZE = 80
// The reverse of the counter: blue for the Americans, red for the Japanese (indexed by side).
const DAMAGED_BACKGROUND = ['#081097', '#db0000']

// Indexed by altitude, in the colours of the altitude counters; planes flying very high carry none (4.2.4).
const ALTITUDE_TABS: Record<number, { fill: string, text: string }> = {
  1: {fill: '#0d9a0d', text: '#ffff00'},
  2: {fill: '#8fd32a', text: '#ffff00'},
  3: {fill: '#ffef00', text: '#c80000'},
  4: {fill: '#e2700a', text: '#c80000'},
}

// A tab outside the counter's rear edge, so that it covers none of the printed stats.
function altitudeTab(altitude: number): string {
  const tab = ALTITUDE_TABS[altitude]
  if (!tab) return ''
  return `<path d="M26 80h28l-6 13h-16z" fill="${tab.fill}" stroke="black"/>
    <text x="40" y="91" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="11"
      text-anchor="middle" fill="${tab.text}" stroke="black" stroke-width=".4">${altitude}</text>`
}

// 2.2: replaces the bomb load printed on the counter with the series of bombs still on board.
function bombsLeftDigit(plane: ViewPlaneInstance): string {
  if (!plane.plane.udzwig_bomb) return ''
  const bombs = plane.plane.udzwig_bomb - (plane.bombs_dropped ?? 0)
  const background = plane.damaged ? DAMAGED_BACKGROUND[parseInt(plane.id)] : 'white'
  return `<rect x="60" y="38" width="18" height="26" fill="${background}"/>
    <text x="69" y="61" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="28"
      text-anchor="middle" fill="${bombs > 0 ? '#147a14' : '#8a8a8a'}">${bombs}</text>`
}

export function createPlaneCounter(plane: ViewPlaneInstance, center = getHexCenterInSVGCoords(plane.at)): SVGElement {
  const imgSrc = `./${plane.plane.img}${plane.damaged ? '_' : ''}.jpg`
  const imgW = parseFloat(planePlaceholder!.getAttribute('width')!)
  const imgH = parseFloat(planePlaceholder!.getAttribute('height')!)

  const counter = planePlaceholder!.cloneNode(false) as SVGImageElement
  counter.removeAttribute('id')
  counter.setAttributeNS(NS_XLINK, 'xlink:href', imgSrc)
  counter.setAttribute('href', imgSrc)
  counter.setAttribute('x', String(center.x - imgW / 2))
  counter.setAttribute('y', String(center.y - imgH / 2))
  const rotation = `rotate(${plane.direction * 60}, ${center.x}, ${center.y})`
  counter.setAttribute('transform', rotation)

  const group = document.createElementNS(svgNS, 'g')
  group.appendChild(counter)

  const overlays = document.createElementNS(svgNS, 'g')
  overlays.setAttribute('transform', `${rotation} translate(${center.x - imgW / 2}, ${center.y - imgH / 2}) scale(${imgW / ART_SIZE})`)
  overlays.style.pointerEvents = 'none'
  overlays.innerHTML = altitudeTab(plane.altitude ?? 5) + bombsLeftDigit(plane)
  group.appendChild(overlays)

  if (plane.jammed) {
    group.appendChild(createSvgMarkerAt(center, jammedSvg))
  }

  return group;
}
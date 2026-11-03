import {planeBorder} from "./planeBorder";
import {HEX_ACTIONS} from "./hexActions";
import {hexOverlay} from "./refs/hexOverlay";
import {expandedStackLayer} from "./refs/expandedStackLayer";
import {planePlaceholder} from "./refs/planePlaceholder";
import {createPlaneCounter} from "./createPlaneCounter";
import {getHexCenterInSVGCoords} from "./svg/getHexCenterInSVGCoords";
import {svgNS} from "@rzymek/rally-the-troops-module/client";
import {ViewPlaneInstance} from "../shared/view";

const STACK_STEP = 2.5
// Keeps big stacks within their hex: the step shrinks rather than the stack growing past this.
const STACK_MAX_SPREAD = 10

let expandedHex: string | undefined

// Shifts each counter diagonally, so that the ones below stay visible. The stack stays centered on its hex.
function stackedCenter(plane: ViewPlaneInstance, stack: ViewPlaneInstance[]): DOMPoint {
  const center = getHexCenterInSVGCoords(plane.at)
  const step = Math.min(STACK_STEP, STACK_MAX_SPREAD / (stack.length - 1))
  const offset = (stack.indexOf(plane) - (stack.length - 1) / 2) * step
  return new DOMPoint(center.x + offset, center.y - offset)
}

export function collapseStack() {
  if (expandedHex === undefined) return
  expandedHex = undefined
  drawPlanes()
}

// Lays the planes out in a column around their hex, kept within the map. Draws the backdrop.
function expandStack(planes: ViewPlaneInstance[]): Map<string, DOMPoint> {
  const center = getHexCenterInSVGCoords(planes[0].at)
  // Enough room for the counters not to overlap, whatever their rotation.
  const spacing = Math.hypot(
    parseFloat(planePlaceholder.getAttribute('width')!),
    parseFloat(planePlaceholder.getAttribute('height')!),
  )
  const height = spacing * planes.length
  const mapHeight = document.querySelector<SVGSVGElement>('#mapwrap svg')!.viewBox.baseVal.height
  const top = Math.max(0, Math.min(center.y - height / 2, mapHeight - height))

  const backdrop = document.createElementNS(svgNS, 'rect')
  backdrop.setAttribute('x', String(center.x - spacing / 2))
  backdrop.setAttribute('y', String(top))
  backdrop.setAttribute('width', String(spacing))
  backdrop.setAttribute('height', String(height))
  backdrop.setAttribute('rx', '4')
  backdrop.setAttribute('fill', 'black')
  backdrop.setAttribute('fill-opacity', '0.5')
  expandedStackLayer.appendChild(backdrop)

  return new Map(planes.map((plane, i) => [plane.id, new DOMPoint(center.x, top + spacing * (i + 0.5))]))
}

export function drawPlanes() {
  const unitsLayer = document.getElementById("units")!
  unitsLayer.innerHTML = ""
  hexOverlay.innerHTML = ""
  expandedStackLayer.innerHTML = ""

  const planes = Object.entries(view.board.planes)
    .flatMap(([roleStr, rolePlanes]) => rolePlanes
      .filter(plane => plane && !plane.destroyed && document.getElementById(plane.at))
      .map(plane => ({plane, isActiveSide: parseInt(roleStr) === view.active_side})))
    // The lowest planes are drawn first and end up covered.
    .sort((a, b) => (a.plane.altitude ?? 5) - (b.plane.altitude ?? 5))

  const planesAt = (hex: string) => planes.map(it => it.plane).filter(plane => plane.at === hex)

  const expanded = expandedHex === undefined ? [] : planesAt(expandedHex)
  if (expanded.length < 2) expandedHex = undefined
  // Reversed, so the highest plane is at the top of the column.
  const expandedCenters = expandedHex === undefined ? new Map<string, DOMPoint>() : expandStack(expanded.reverse())

  const addBorder = (plane: ViewPlaneInstance, color: string) => {
    const center = expandedCenters.get(plane.id)
    const layer = center ? expandedStackLayer : hexOverlay
    layer.appendChild(planeBorder(plane, color, center ?? stackedCenter(plane, planesAt(plane.at))))
  }

  for (const {plane} of planes) {
    if (view.unmoved?.includes(plane.id)) addBorder(plane, 'yellow')
  }
  for (const {plane} of planes) {
    if (plane.id === view.selected_plane) addBorder(plane, 'blue')
  }

  for (const {plane, isActiveSide} of planes) {
    const center = expandedCenters.get(plane.id)
    const counter = createPlaneCounter(plane, center ?? stackedCenter(plane, planesAt(plane.at)));

    // Dim planes that have already shot this phase
    const hasShot = view.shot?.includes(plane.id)
    if (isActiveSide && hasShot && !plane.damaged) {
      counter.setAttribute('opacity', '0.55')
    }

    const isSelectable = view.actions?.select_plane?.includes(plane.id)
    const isFireTarget = plane.id === view.fire_target
    // 5.3.1: another plane on the fire lines, to pick as the target instead.
    const isOtherTarget = !isFireTarget && !!view.actions?.target?.includes(plane.id)
    const isAaTarget = view.actions?.aa_fire?.includes(plane.id)
    if (isFireTarget || isAaTarget) addBorder(plane, 'orange')
    else if (isOtherTarget) addBorder(plane, '#ffcc80')
    else if (isSelectable && plane.id !== view.selected_plane) addBorder(plane, 'red')

    if (!center && HEX_ACTIONS.some(it => view.actions?.[it]?.includes(plane.at))) {
      // Let clicks through to the hex underneath
      counter.style.pointerEvents = 'none'
    } else if (!center && planesAt(plane.at).length > 1) {
      counter.style.cursor = 'pointer'
      counter.addEventListener('click', e => {
        e.stopPropagation()
        expandedHex = plane.at
        drawPlanes()
      })
    } else if (isAaTarget) {
      counter.style.cursor = 'pointer'
      counter.addEventListener('click', e => {
        e.stopPropagation()
        expandedHex = undefined
        send_action("aa_fire", plane.id)
      })
    } else if (isOtherTarget) {
      counter.style.cursor = 'pointer'
      counter.addEventListener('click', e => {
        e.stopPropagation()
        expandedHex = undefined
        send_action("target", plane.id)
      })
    } else if (isFireTarget) {
      counter.style.cursor = 'pointer'
      counter.addEventListener('click', e => {
        e.stopPropagation()
        expandedHex = undefined
        send_action("attack", undefined)
      })
    } else if (isSelectable) {
      counter.style.cursor = 'pointer'
      counter.addEventListener('click', e => {
        e.stopPropagation()
        expandedHex = undefined
        send_action("select_plane", plane.id)
      })
    } else if (!center) {
      // Let clicks through to the hex underneath
      counter.style.pointerEvents = 'none'
    }

    if (center) {
      expandedStackLayer.appendChild(counter)
    } else {
      unitsLayer.appendChild(counter)
    }
  }
}

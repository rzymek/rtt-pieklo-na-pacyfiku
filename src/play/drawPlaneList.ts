import {ViewPlaneInstance} from "../shared/view";
import {planeBorder} from "./planeBorder";
import {expandedStackLayer} from "./refs/expandedStackLayer";

// ROLE_NAMES, which the client may not import from the rules.
const SIDE_NAMES = ["Amerykanie", "Japończycy"]

// 2.2: every plane with the endurance it has left, so that it can be checked without reading the counters.
export function drawPlaneList() {
  const list = document.getElementById('plane_list')!
  list.innerHTML = ''
  for (const [sideStr, planes] of Object.entries(view.board.planes)) {
    const side = Number(sideStr)
    const section = document.createElement('div')
    section.className = `plane_list_side side_${side}`
    const header = document.createElement('div')
    header.className = 'plane_list_header'
    header.textContent = SIDE_NAMES[side]
    section.appendChild(header)
    for (const plane of planes) {
      if (plane) section.appendChild(planeRow(plane))
    }
    for (const off of (view.off_board ?? []).filter(it => it.side === side)) {
      const row = document.createElement('div')
      row.className = 'plane_row off'
      row.innerHTML = `<span class="name"></span><span class="hp">etap ${off.return_stage}</span>`
      row.querySelector('.name')!.textContent = `${off.name} (poza planszą)`
      section.appendChild(row)
    }
    list.appendChild(section)
  }
}

function planeRow(plane: ViewPlaneInstance): HTMLElement {
  const max = plane.plane.wytrzymalosc
  const left = Math.max(0, max - (plane.damage ?? 0))
  const row = document.createElement('div')
  row.className = 'plane_row'
  if (plane.destroyed) row.classList.add('destroyed')
  else if (plane.damaged) row.classList.add('damaged')
  else if (left < max) row.classList.add('hit')

  const name = document.createElement('span')
  name.className = 'name'
  name.textContent = plane.plane.nazwa
  const hp = document.createElement('span')
  hp.className = 'hp'
  hp.textContent = plane.destroyed ? (plane.left_board ? 'opuścił planszę' : 'zestrzelony') : `${left}/${max}`
  row.append(name, hp)
  if (!plane.destroyed) {
    row.title = plane.damaged ? 'poważnie uszkodzony' : left < max ? 'uszkodzony' : 'sprawny'
    // Points out the plane on the map.
    let border: SVGElement | undefined
    row.addEventListener('mouseenter', () => {
      if (!document.getElementById(plane.at)) return
      border = planeBorder(plane, '#00ff00')
      border.setAttribute('stroke-width', '4')
      expandedStackLayer.appendChild(border)
    })
    row.addEventListener('mouseleave', () => {
      border?.remove()
      border = undefined
    })
  }
  return row
}

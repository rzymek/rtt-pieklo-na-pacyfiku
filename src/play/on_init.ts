import {hexOverlay} from "./refs/hexOverlay";
import {bombedLayer} from "./refs/bombedLayer";
import {targetsLayer} from "./refs/targetsLayer";
import {aaGunsLayer} from "./refs/aaGunsLayer";
import {clickableAaGunsLayer} from "./refs/clickableAaGunsLayer";
import {sunLayer} from "./refs/sunLayer";
import {shipsLayer} from "./refs/shipsLayer";
import {returnHexesLayer} from "./refs/returnHexesLayer";
import {planePlaceholder} from "./refs/planePlaceholder";
import {expandedStackLayer} from "./refs/expandedStackLayer";
import {collapseStack} from "./drawPlanes";
import {HEX_ACTIONS} from "./hexActions";

export function onInit() {
  planePlaceholder.remove()
  toggle_zoom()

  // Click on a hex → send move_hex or bomb if it's a valid target
  document.querySelectorAll('#hexes use').forEach(el => {
    el.addEventListener('click', () => {
      const hexAction = HEX_ACTIONS.find(it => view.actions?.[it]?.includes(el.id))
      if (hexAction) send_action(hexAction, el.id)
    })
  })

  const svg = document.querySelector('#mapwrap svg')!
  shipsLayer.id = 'ships'
  svg.insertBefore(shipsLayer, document.getElementById('units'))
  sunLayer.id = 'sun'
  svg.insertBefore(sunLayer, document.getElementById('units'))
  targetsLayer.id = 'targets'
  svg.insertBefore(targetsLayer, document.getElementById('units'))
  bombedLayer.id = 'bombed'
  svg.insertBefore(bombedLayer, document.getElementById('units'))
  returnHexesLayer.id = 'return-hexes'
  svg.insertBefore(returnHexesLayer, document.getElementById('units'))
  aaGunsLayer.id = 'aa-guns'
  svg.insertBefore(aaGunsLayer, document.getElementById('units'))
  hexOverlay.id = 'hex-overlay'
  svg.insertBefore(hexOverlay, document.getElementById('units'))
  // Under the planes like the other guns: the part sticking out from under a counter stays clickable.
  clickableAaGunsLayer.id = 'clickable-aa-guns'
  svg.insertBefore(clickableAaGunsLayer, document.getElementById('units'))
  expandedStackLayer.id = 'expanded-stack'
  svg.appendChild(expandedStackLayer)

  // Counters that act on a click stop it from getting here
  svg.addEventListener('click', collapseStack)

  const hexTemplate = document.getElementById('hexTemplate')!;
  hexTemplate.classList.add('hex');
  hexTemplate.removeAttribute('fill-opacity');
  console.log(hexTemplate)
}
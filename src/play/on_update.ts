import {clearHexHighlights, highlightHexes} from "@rzymek/rally-the-troops-module/client";
import {drawPlanes} from "./drawPlanes";
import {drawBombed} from "./drawBombed";
import {drawTargets} from "./drawTargets";
import {drawAaGuns} from "./drawAaGuns";
import {drawSun} from "./drawSun";
import {drawShips} from "./drawShips";
import {drawReturnHexes} from "./drawReturnHexes";

export function onUpdate() {
  // action_button prepends, so the last one ends up first
  action_button("next_type", "Inny typ samolotu")
  action_button("turn_right", "Obróć w prawo")
  action_button("turn_left", "Obróć w lewo")
  action_button("leave_forever", "Nie wróci")
  action_button("leave_return", "Wróci")
  action_button("leave_board", "Opuść planszę")
  // 4.2.1, the rules' ALTITUDE_ACTIONS: the client may not share code with the rules.
  action_button("wysokosc_5", "5 – bardzo wysoko")
  action_button("wysokosc_4", "4 – wysoko")
  action_button("wysokosc_3", "3 – nisko")
  action_button("wysokosc_2", "2 – bardzo nisko")
  action_button("wysokosc_1", "1 – najniżej")
  action_button("deselect", "Odznacz samolot")
  action_button("unjam", "Odblokuj karabiny")
  action_button("attack", "Atakuj")
  action_button("cancel", "Anuluj")
  action_button("confirm_done", "Zakończ fazę walki")
  action_button("done", "Done")
  action_button("undo", "Undo")

  document.querySelectorAll('#hexes .action').forEach(el => el.classList.remove('action'))

  view.actions?.move_hex
    ?.map(id => document.getElementById(id))
    ?.forEach(el => el?.classList.remove('action'))

  clearHexHighlights();
  highlightHexes(view.actions?.move_hex, '#8080ff');
  highlightHexes(view.fire_line, '#ff4444');
  highlightHexes(view.actions?.bomb, '#ff9900');
  highlightHexes(view.actions?.torpedo, '#ff9900');
  highlightHexes(view.actions?.place_gun, '#ffff66');
  highlightHexes(view.actions?.place_plane, '#66ff66');
  highlightHexes(view.actions?.return_hex, '#66ff66');
  highlightHexes(view.actions?.leave_hex, '#ff66ff');

  // 2.0, 4.3.1: the stage track.
  document.getElementById('turn_info')!.textContent = [
    `Etap ${view.stage}`,
    ...(view.off_board ?? []).map(it => `${it.name}: powrót w etapie ${it.return_stage}`),
  ].join('\n')

  // 8.0
  for (const side of Object.keys(view.vp ?? {})) {
    const stat = roles[side]?.stat
    if (stat) stat.textContent = `${view.vp![Number(side)]} / ${view.min_vp?.[Number(side)]} PZ`
  }

  for (const [side, planes] of Object.entries(view.board?.planes ?? {})) {
    const info = roles[side]?.stat.parentElement?.querySelector('.role_info')
    if (info) info.textContent = `Stracone samoloty: ${planes.filter(plane => plane.destroyed && !plane.left_board).length}`
  }

  drawShips()
  drawSun()
  drawTargets()
  drawBombed()
  drawReturnHexes()
  drawPlanes()
  drawAaGuns()
}

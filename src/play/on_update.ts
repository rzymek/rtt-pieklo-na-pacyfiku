import {clearHexHighlights, highlightHexes} from "@rzymek/rally-the-troops-module/client";
import {drawPlanes} from "./drawPlanes";
import {drawBombed} from "./drawBombed";
import {drawTargets} from "./drawTargets";
import {drawAaGuns} from "./drawAaGuns";
import {drawSun} from "./drawSun";
import {drawShips} from "./drawShips";
import {drawReturnHexes} from "./drawReturnHexes";
import {drawPlaneList} from "./drawPlaneList";

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
  highlightHexes(view.actions?.move_hex, '#00ffff');
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
    // 8.0.1
    ...(view.standing ? [`Obecnie: ${view.standing}`] : []),
    ...(view.off_board ?? []).map(it => `${it.name}: powrót w etapie ${it.return_stage}`),
  ].join('\n')

  for (const side of Object.keys(view.lost ?? {})) {
    const stat = roles[side]?.stat
    if (stat) stat.textContent = `straty: ${view.lost![Number(side)]}`
  }

  drawShips()
  drawSun()
  drawTargets()
  drawBombed()
  drawReturnHexes()
  drawPlanes()
  drawAaGuns()
  drawPlaneList()
}

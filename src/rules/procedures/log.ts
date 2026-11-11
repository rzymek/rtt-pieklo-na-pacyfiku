import {G, ROLES} from "../globals";

// A log line may start with ".class" tokens: on_log (play/play.ts) turns them into CSS classes of the line.
function line(classes: string[], text: string) {
  flushPhase()
  log([...classes.map(it => `.${it}`), text].join(" "))
}

function flushPhase() {
  if (!G.log_phase) return
  log(G.log_phase)
  delete G.log_phase
}

// The phase header waits for the first line of the phase, so phases where nothing happened leave no trace.
export function logPhase(side: number, name: string) {
  G.log_phase = `.h2 .s${side} ${ROLES[side]} – ${name}`
}

export function logStage(stage: number) {
  delete G.log_phase
  log(`.h1 Etap ${stage}`)
}

export function logEvent(side: number | null, text: string) {
  line(side === null ? [] : [`s${side}`], text)
}

// A plane lost without a roll, marked like a kill.
export function logLoss(side: number, text: string) {
  line([`s${side}`, "kill"], text)
}

// An attack: who at whom, then the dice and the outcome indented below, coloured by how it ended.
export function logAttack(side: number | null, what: string, dice: string, result: string) {
  const sideClass = side === null ? [] : [`s${side}`]
  line(sideClass, what)
  line([...sideClass, "res", outcomeClass(result)], `${dice} → ${result}`)
}

// The outcome of a hit applied later than the shot was rolled (5.4).
export function logOutcome(side: number, target: string, result: string) {
  line([`s${side}`, "res", outcomeClass(result)], `${target}: ${result}`)
}

export function shotDice(atk: number, distance: number, roll: number) {
  return `SA ${atk} · odl. ${distance} · rzut ${roll}`
}

export function outcomeClass(result: string): string {
  if (/zestrzelony|zatopiony|zniszczone|zderzenie/.test(result)) return "kill"
  if (/zacięcie/.test(result)) return "jam"
  if (/uszkodz|trafien|trafiony/.test(result)) return "dmg"
  if (/pudło|bez skutku|bez kolizji|ocalało/.test(result)) return "miss"
  return "other"
}

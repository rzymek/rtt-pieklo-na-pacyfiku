import {describe, expect, it} from "vitest";
import {outcomeClass} from "./log";

describe("outcomeClass", () => {
  it.each([
    ["uszkodzenia: 3 → zestrzelony", "kill"],
    ["trafienie, jedynka na kości → zestrzelony", "kill"],
    ["uszkodzenia: 2 → Lexington zatopiony", "kill"],
    ["zniszczone", "kill"],
    ["zderzenie – oba zniszczone", "kill"],
    ["uszkodzenia: 1 → uszkodzony, pozostała wytrzymałość 2/6", "dmg"],
    ["trafienie → poważnie uszkodzony, pozostała wytrzymałość 1/4", "dmg"],
    ["zacięcie karabinów", "jam"],
    ["pudło", "miss"],
    ["bez skutku", "miss"],
    ["pod ostrzałem", "other"],
  ])("%s → %s", (result, expected) => {
    expect(outcomeClass(result)).toBe(expected)
  })
})

// Log lines may start with ".class" tokens (rules/procedures/log.ts), which become CSS classes of the line.
export function onLog(text: string): HTMLElement {
  const div = document.createElement("div")
  const match = /^((?:\.[\w-]+ )+)/.exec(text)
  if (match) {
    div.className = match[1].trim().split(" ").map(it => it.slice(1)).join(" ")
    text = text.slice(match[1].length)
  }
  div.textContent = text
  return div
}

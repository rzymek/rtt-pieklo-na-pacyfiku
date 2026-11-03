// Not `roles`: the name would end up at the top level of rules.js, next to the framework's code.
export const ROLE_NAMES = ["Amerykanie", "Japończycy"] as const;
export type Player = typeof ROLE_NAMES[number];

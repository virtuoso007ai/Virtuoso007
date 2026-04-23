/** Degen forum agent + SIGNALS thread — dashboard ile aynı kaynak. */
export const AGENT_FORUM_IDS: Record<string, number> = {
  doctorstrange: 618,
  friday: 138,
  ichimoku: 140,
  pokedex: 178,
  raichu: 137,
  redkid: 634,
  spongebob: 631,
  squirtle: 467,
  taxerclaw: 136,
  venom: 622,
  virgen: 428,
  welles: 139,
};

export const AGENT_SIGNALS_THREAD_IDS: Record<string, number> = {
  doctorstrange: 668,
  friday: 102,
  ichimoku: 106,
  pokedex: 136,
  raichu: 100,
  redkid: 692,
  spongebob: 688,
  squirtle: 464,
  taxerclaw: 98,
  venom: 674,
  virgen: 414,
  welles: 104,
};

export function getAgentForumId(alias: string): number | null {
  const id = AGENT_FORUM_IDS[alias.toLowerCase()];
  return id && id > 0 ? id : null;
}

export function getAgentSignalsThreadId(alias: string): number | null {
  const id = AGENT_SIGNALS_THREAD_IDS[alias.toLowerCase()];
  return id && id > 0 ? id : null;
}

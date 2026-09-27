// Pure, dependency-free bracket-generation utilities.
//
// Ported from the Grapple Flows BJJ bracket generator
// (https://grappleflows.com/brackets). There is intentionally no I/O, no DOM,
// and no external dependency here, so the logic runs in browsers, Node, Deno,
// and workers, and is trivially testable.

export type EliminationStyle = 'single' | 'double' | 'round_robin';

export interface Competitor {
  id: string;
  name: string;
  seed: number;
  /** Academy / team, used to keep teammates apart in the first round. */
  team?: string;
}

export type MatchSide = 'a' | 'b';

/** Recorded winners, keyed by match id. Only single elimination and round
 *  robin take results; double elimination stays a preview of the draw. */
export type BracketResults = Record<string, MatchSide>;

export interface BracketMatch {
  id: string;
  a: Competitor | null;
  b: Competitor | null;
  // A bye means one side automatically advances (no opponent). We still render
  // the match so the bracket shape reads correctly.
  isBye?: boolean;
  /** Set when a result is recorded for a real contest (both sides filled). */
  winner?: MatchSide;
}

export interface BracketRound {
  name: string;
  matches: BracketMatch[];
}

export interface BracketSection {
  title: string;
  rounds: BracketRound[];
}

export interface Bracket {
  style: EliminationStyle;
  sections: BracketSection[];
}

export const ELIMINATION_STYLE_LABELS: Record<EliminationStyle, string> = {
  single: 'Single elimination',
  double: 'Double elimination',
  round_robin: 'Round robin',
};

export const ELIMINATION_STYLE_DESCRIPTIONS: Record<EliminationStyle, string> = {
  single:
    'Lose once and you are out. Each competitor is seeded into a single knockout tree.',
  double:
    'A loss drops you to the losers bracket, and you are only out after a second loss. The bracket winners meet in a grand final.',
  round_robin:
    'Everyone faces everyone else once, and the competitor with the best overall record wins.',
};

export const ELIMINATION_STYLES: EliminationStyle[] = ['single', 'double', 'round_robin'];

// --- helpers --------------------------------------------------------------

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard seed ordering for a single-elimination bracket of `size` slots.
// Produces the classic "1 plays lowest, 2 plays second lowest" tournament
// shape (e.g. for size 8: [1,8,4,5,2,7,3,6]). Returns 1-based seed positions.
function seedOrder(size: number): number[] {
  let rounds: number[] = [1, 2];
  while (rounds.length < size) {
    const next: number[] = [];
    const sum = rounds.length * 2 + 1;
    for (const seed of rounds) {
      next.push(seed);
      next.push(sum - seed);
    }
    rounds = next;
  }
  return rounds;
}

// The competitor who advances out of a match, when that is already known.
// A bye (exactly one side filled) has a guaranteed winner, so we can carry that
// competitor into the next round instead of showing "TBD". A real contest (both
// sides filled) has no decided winner yet, so it feeds an empty/TBD slot.
function decidedWinner(match: BracketMatch): Competitor | null {
  if (match.a && match.b) {
    if (match.winner === 'a') return match.a;
    if (match.winner === 'b') return match.b;
    return null;
  }
  return match.a ?? match.b ?? null;
}

// Attach a recorded result to a match, but only when it is a real contest.
// A stale result (the slot changed after an upstream edit) is dropped rather
// than carried into the wrong pairing.
function withResult(match: BracketMatch, results: BracketResults): BracketMatch {
  const side = results[match.id];
  if (!side || !match.a || !match.b) return match;
  return { ...match, winner: side };
}

function roundNameForMatchCount(matchCount: number): string {
  switch (matchCount) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinals';
    case 4:
      return 'Quarterfinals';
    default:
      return `Round of ${matchCount * 2}`;
  }
}

// --- single elimination ---------------------------------------------------

function buildSingleElimination(
  competitors: Competitor[],
  results: BracketResults = {},
  separateTeams = false,
): BracketSection {
  const rounds: BracketRound[] = [];
  const n = competitors.length;

  if (n < 2) {
    return { title: 'Bracket', rounds };
  }

  const size = nextPowerOfTwo(n);
  const order = seedOrder(size);

  // Slot the competitors into their seeded positions; empty positions are byes.
  const seeded: (Competitor | null)[] = order.map((seed) =>
    seed <= n ? competitors[seed - 1] ?? null : null,
  );
  const slots = separateTeams ? separateTeammates(seeded) : seeded;

  // First round.
  const firstMatches: BracketMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i] ?? null;
    const b = slots[i + 1] ?? null;
    firstMatches.push(
      withResult(
        {
          id: `se-r1-m${i / 2 + 1}`,
          a,
          b,
          isBye: a === null || b === null,
        },
        results,
      ),
    );
  }
  rounds.push({ name: roundNameForMatchCount(firstMatches.length), matches: firstMatches });

  // Subsequent rounds carry forward any competitor whose prior match is already
  // decided by a bye; undecided contests still feed a TBD slot. Match m of a
  // round is fed by matches 2m and 2m+1 of the previous round.
  let prevMatches = firstMatches;
  let roundIndex = 2;
  while (prevMatches.length > 1) {
    const matchCount = prevMatches.length / 2;
    const matches: BracketMatch[] = [];
    for (let m = 0; m < matchCount; m++) {
      matches.push(
        withResult(
          {
            id: `se-r${roundIndex}-m${m + 1}`,
            a: decidedWinner(prevMatches[2 * m]),
            b: decidedWinner(prevMatches[2 * m + 1]),
          },
          results,
        ),
      );
    }
    rounds.push({ name: roundNameForMatchCount(matchCount), matches });
    prevMatches = matches;
    roundIndex += 1;
  }

  return { title: 'Bracket', rounds };
}

// --- double elimination ---------------------------------------------------

function buildDoubleElimination(
  competitors: Competitor[],
  separateTeams = false,
): BracketSection[] {
  const winners = buildSingleElimination(competitors, {}, separateTeams);
  winners.title = 'Winners bracket';

  const sections: BracketSection[] = [winners];

  const n = competitors.length;
  if (n < 2) {
    return sections;
  }

  // Losers bracket has a standard shape derived from the winners bracket size.
  // For a winners bracket of `size` slots there are (size - 1) winners-bracket
  // matches and (size - 2) losers-bracket matches, arranged in 2*(rounds-1)
  // losers rounds that alternate between "minor" and "major" rounds.
  const size = nextPowerOfTwo(n);
  const winnersRounds = Math.log2(size); // integer

  const losersRounds: BracketRound[] = [];
  // The number of distinct losers rounds is 2 * (winnersRounds - 1).
  // Match counts follow the well-known pattern: each pair of losers rounds has
  // the same match count, halving as the bracket progresses.
  let matchCount = size / 4; // first losers round size for size>=4
  if (size >= 4) {
    let lr = 1;
    for (let w = 1; w < winnersRounds; w++) {
      // Minor round: losers from this winners round drop in against survivors.
      const minor: BracketMatch[] = [];
      for (let m = 0; m < matchCount; m++) {
        minor.push({ id: `le-r${lr}-m${m + 1}`, a: null, b: null });
      }
      losersRounds.push({ name: `Losers round ${lr}`, matches: minor });
      lr += 1;

      // Major round (consolidation): same match count, except after the very
      // last winners round there is no further consolidation.
      if (w < winnersRounds - 1) {
        const major: BracketMatch[] = [];
        for (let m = 0; m < matchCount; m++) {
          major.push({ id: `le-r${lr}-m${m + 1}`, a: null, b: null });
        }
        losersRounds.push({ name: `Losers round ${lr}`, matches: major });
        lr += 1;
        matchCount = Math.max(1, matchCount / 2);
      }
    }
  } else {
    // size === 2: a single losers match (just the grand final, effectively).
    losersRounds.push({ name: 'Losers round 1', matches: [{ id: 'le-r1-m1', a: null, b: null }] });
  }

  sections.push({ title: 'Losers bracket', rounds: losersRounds });

  // Grand final: winners-bracket champion vs losers-bracket champion.
  sections.push({
    title: 'Grand final',
    rounds: [
      {
        name: 'Grand final',
        matches: [{ id: 'gf-m1', a: null, b: null }],
      },
    ],
  });

  return sections;
}

// --- round robin ----------------------------------------------------------

function buildRoundRobin(
  competitors: Competitor[],
  results: BracketResults = {},
): BracketSection {
  const rounds: BracketRound[] = [];
  if (competitors.length < 2) {
    return { title: 'Round robin', rounds };
  }

  // Circle method. With an odd number of competitors we add a "bye" placeholder
  // that rotates through the schedule.
  const players: (Competitor | null)[] = [...competitors];
  if (players.length % 2 === 1) {
    players.push(null); // bye marker
  }

  const numPlayers = players.length;
  const numRounds = numPlayers - 1;
  const half = numPlayers / 2;

  // Fixed player sits at index 0; the rest rotate.
  const rotating = players.slice(1);

  for (let r = 0; r < numRounds; r++) {
    const lineup: (Competitor | null)[] = [players[0] ?? null, ...rotating];
    const matches: BracketMatch[] = [];
    for (let i = 0; i < half; i++) {
      const a = lineup[i] ?? null;
      const b = lineup[numPlayers - 1 - i] ?? null;
      matches.push(
        withResult(
          {
            id: `rr-r${r + 1}-m${i + 1}`,
            a,
            b,
            isBye: a === null || b === null,
          },
          results,
        ),
      );
    }
    rounds.push({ name: `Round ${r + 1}`, matches });

    // Rotate clockwise for the next round.
    const last = rotating.pop();
    if (last !== undefined) {
      rotating.unshift(last);
    }
  }

  return { title: 'Round robin', rounds };
}

// --- public builder -------------------------------------------------------

export interface BuildOptions {
  results?: BracketResults;
  /** Swap first-round pairings so teammates do not meet in round one. */
  separateTeams?: boolean;
}

export function buildBracket(
  competitors: Competitor[],
  style: EliminationStyle,
  options: BuildOptions = {},
): Bracket {
  const results = options.results ?? {};
  const separate = options.separateTeams ?? false;
  switch (style) {
    case 'single':
      return { style, sections: [buildSingleElimination(competitors, results, separate)] };
    case 'double':
      return { style, sections: buildDoubleElimination(competitors, separate) };
    case 'round_robin':
      return { style, sections: [buildRoundRobin(competitors, results)] };
    default:
      return { style, sections: [] };
  }
}

export function makePreviewCompetitors(count: number): Competitor[] {
  const safe = Math.max(0, Math.floor(count));
  const competitors: Competitor[] = [];
  for (let i = 0; i < safe; i++) {
    const seed = i + 1;
    competitors.push({
      id: `competitor-${seed}`,
      name: `Competitor ${seed}`,
      seed,
    });
  }
  return competitors;
}

/** Whether results can be recorded for a style (double elimination is a
 *  preview of the draw shape only). */
export function styleTakesResults(style: EliminationStyle): boolean {
  return style === 'single' || style === 'round_robin';
}

// --- entrants -------------------------------------------------------------

export const MAX_ENTRANTS = 64;

/** Parse the "one per line, team after a comma" entrant list. Blank lines are
 *  skipped, whitespace trimmed, and the list capped at MAX_ENTRANTS. Order is
 *  seed order. */
export function parseEntrants(text: string): Competitor[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_ENTRANTS);
  return lines.map((line, index) => {
    const comma = line.indexOf(',');
    const name = (comma === -1 ? line : line.slice(0, comma)).trim().slice(0, 40);
    const team = comma === -1 ? '' : line.slice(comma + 1).trim().slice(0, 40);
    const seed = index + 1;
    return {
      id: `competitor-${seed}`,
      name: name || `Competitor ${seed}`,
      seed,
      ...(team ? { team } : {}),
    };
  });
}

/** Inverse of parseEntrants, for writing a shuffled order back to the box. */
export function formatEntrants(competitors: Competitor[]): string {
  return competitors.map((c) => (c.team ? `${c.name}, ${c.team}` : c.name)).join('\n');
}

/** Fisher–Yates over a copy. `random` is injectable for tests. */
export function shuffleLines(text: string, random: () => number = Math.random): string {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  return lines.join('\n');
}

const sameTeam = (a: Competitor | null, b: Competitor | null): boolean =>
  Boolean(a && b && a.team && b.team && a.team.toLowerCase() === b.team.toLowerCase());

/** Rearrange first-round slots so no pair are teammates, where possible.
 *  Works pair by pair: when a pair clashes, swap its lower seed with the
 *  closest-seeded competitor from another pair that stays clash-free after
 *  the swap. Byes never move, so the top seeds keep them. */
export function separateTeammates(slots: (Competitor | null)[]): (Competitor | null)[] {
  const out = [...slots];
  const pairs = out.length / 2;
  for (let p = 0; p < pairs; p++) {
    const i = 2 * p;
    if (!sameTeam(out[i], out[i + 1])) continue;
    // Move whichever side is the weaker seed.
    const moveIndex = (out[i]?.seed ?? 0) > (out[i + 1]?.seed ?? 0) ? i : i + 1;
    const stayIndex = moveIndex === i ? i + 1 : i;
    const moving = out[moveIndex] as Competitor;
    let best = -1;
    let bestGap = Infinity;
    for (let q = 0; q < pairs; q++) {
      if (q === p) continue;
      for (const k of [2 * q, 2 * q + 1]) {
        const candidate = out[k];
        const partner = out[k === 2 * q ? 2 * q + 1 : 2 * q];
        if (!candidate || !partner) continue; // never break up a bye
        if (sameTeam(candidate, out[stayIndex])) continue;
        if (sameTeam(moving, partner)) continue;
        const gap = Math.abs(candidate.seed - moving.seed);
        if (gap < bestGap) {
          best = k;
          bestGap = gap;
        }
      }
    }
    if (best !== -1) {
      [out[moveIndex], out[best]] = [out[best], out[moveIndex]];
    }
  }
  return out;
}

/** First-round pairs that are still teammates (the draw could not avoid it). */
export function countTeammateClashes(bracket: Bracket): number {
  const first = bracket.sections[0]?.rounds[0];
  if (!first) return 0;
  return first.matches.filter((m) => sameTeam(m.a, m.b)).length;
}

// --- results ----------------------------------------------------------------

export interface Podium {
  gold: Competitor | null;
  silver: Competitor | null;
  /** IBJJF awards bronze to both losing semifinalists. */
  bronze: Competitor[];
}

const loserOf = (match: BracketMatch): Competitor | null => {
  if (!match.a || !match.b || !match.winner) return null;
  return match.winner === 'a' ? match.b : match.a;
};

/** Medal table for a finished single-elimination bracket, IBJJF style. */
export function singleEliminationPodium(section: BracketSection): Podium {
  const rounds = section.rounds;
  const final = rounds[rounds.length - 1]?.matches[0];
  if (!final || !final.winner || !final.a || !final.b) {
    return { gold: null, silver: null, bronze: [] };
  }
  const semis = rounds.length >= 2 ? rounds[rounds.length - 2].matches : [];
  return {
    gold: final.winner === 'a' ? final.a : final.b,
    silver: loserOf(final),
    bronze: semis.map(loserOf).filter((c): c is Competitor => c !== null),
  };
}

export interface StandingRow {
  competitor: Competitor;
  wins: number;
  losses: number;
  played: number;
}

/** Round-robin table: most wins first, then fewest losses, then seed. */
export function roundRobinStandings(section: BracketSection): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const row = (c: Competitor) => {
    let r = rows.get(c.id);
    if (!r) {
      r = { competitor: c, wins: 0, losses: 0, played: 0 };
      rows.set(c.id, r);
    }
    return r;
  };
  for (const round of section.rounds) {
    for (const match of round.matches) {
      if (match.a) row(match.a);
      if (match.b) row(match.b);
      if (!match.a || !match.b || !match.winner) continue;
      const winner = match.winner === 'a' ? match.a : match.b;
      const loser = match.winner === 'a' ? match.b : match.a;
      row(winner).wins += 1;
      row(winner).played += 1;
      row(loser).losses += 1;
      row(loser).played += 1;
    }
  }
  return [...rows.values()].sort(
    (x, y) => y.wins - x.wins || x.losses - y.losses || x.competitor.seed - y.competitor.seed,
  );
}

/** Contests (not byes) in the bracket, and how many have a result. */
export function resultProgress(bracket: Bracket): { decided: number; total: number } {
  let decided = 0;
  let total = 0;
  for (const section of bracket.sections) {
    for (const round of section.rounds) {
      for (const match of round.matches) {
        if (match.isBye) continue;
        total += 1;
        if (match.winner) decided += 1;
      }
    }
  }
  return { decided, total };
}

// Single-elimination match ids are `se-r<round>-m<match>`; match m of round r
// feeds match ceil(m / 2) of round r + 1.
const SE_ID = /^se-r(\d+)-m(\d+)$/;

/** Toggle a result: tapping the recorded winner again clears it. Changing or
 *  clearing a knockout result also clears every later result on that path,
 *  since whoever advanced from it may no longer be in those matches. */
export function toggleResult(results: BracketResults, matchId: string, side: MatchSide): BracketResults {
  const next = { ...results };
  if (next[matchId] === side) delete next[matchId];
  else next[matchId] = side;

  const parsed = SE_ID.exec(matchId);
  if (parsed) {
    const lastRound = Math.max(
      0,
      ...Object.keys(next).map((key) => Number(SE_ID.exec(key)?.[1] ?? 0)),
    );
    let match = Number(parsed[2]);
    for (let round = Number(parsed[1]) + 1; round <= lastRound; round++) {
      match = Math.ceil(match / 2);
      delete next[`se-r${round}-m${match}`];
    }
  }
  return next;
}

/** Drop results whose match no longer has both competitors (after an edit or
 *  an upstream change), so the saved state matches what is on screen. */
export function pruneResults(bracket: Bracket, results: BracketResults): BracketResults {
  const live: BracketResults = {};
  for (const section of bracket.sections) {
    for (const round of section.rounds) {
      for (const match of round.matches) {
        if (match.winner && results[match.id]) live[match.id] = match.winner;
      }
    }
  }
  return live;
}

// --- match counts (for planning mat time) -----------------------------------

export function matchCounts(n: number): { single: number; double: number; roundRobin: number } {
  const safe = Math.max(0, Math.floor(n));
  if (safe < 2) return { single: 0, double: 0, roundRobin: 0 };
  return {
    single: safe - 1,
    // Every competitor but the champion loses twice, the champion at most once
    // (no grand-final reset): 2n - 2.
    double: 2 * safe - 2,
    roundRobin: (safe * (safe - 1)) / 2,
  };
}

// --- share state ------------------------------------------------------------

export interface SharedBracket {
  style: EliminationStyle;
  entrants: string;
  results: BracketResults;
  /** Teammate separation changes the pairings, so results only line up when
   *  the recipient uses the same setting. */
  separateTeams: boolean;
}

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): string => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

/** Encode a bracket for the URL hash. The hash never reaches a server, so
 *  entrant names stay out of request logs and attribution. */
export function encodeBracketHash(state: SharedBracket): string {
  return `b=${toBase64Url(
    JSON.stringify({ v: 1, s: state.style, e: state.entrants, r: state.results, t: state.separateTeams }),
  )}`;
}

export function decodeBracketHash(hash: string): SharedBracket | null {
  const raw = hash.replace(/^#/, '');
  const match = /(?:^|&)b=([A-Za-z0-9_-]+)/.exec(raw);
  if (!match) return null;
  try {
    const data = JSON.parse(fromBase64Url(match[1])) as {
      v?: number;
      s?: string;
      e?: unknown;
      r?: unknown;
      t?: unknown;
    };
    if (data.v !== 1) return null;
    const style = ELIMINATION_STYLES.includes(data.s as EliminationStyle)
      ? (data.s as EliminationStyle)
      : 'single';
    const entrants = typeof data.e === 'string' ? data.e.slice(0, 6000) : '';
    const results: BracketResults = {};
    if (data.r && typeof data.r === 'object') {
      for (const [id, side] of Object.entries(data.r as Record<string, unknown>)) {
        if ((side === 'a' || side === 'b') && /^[a-z]{2}-r\d+-m\d+$/.test(id)) results[id] = side;
      }
    }
    return { style, entrants, results, separateTeams: data.t !== false };
  } catch {
    return null;
  }
}

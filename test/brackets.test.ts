// Ported from the Grapple Flows app (src/utils/brackets.test.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildBracket,
  countTeammateClashes,
  decodeBracketHash,
  encodeBracketHash,
  formatEntrants,
  makePreviewCompetitors,
  matchCounts,
  parseEntrants,
  pruneResults,
  resultProgress,
  roundRobinStandings,
  separateTeammates,
  shuffleLines,
  singleEliminationPodium,
  toggleResult,
  type BracketResults,
} from '../src/index.js';

// The match-count table printed on https://grappleflows.com/brackets and in
// the README: [competitors, single, double, round robin].
const MATCH_COUNT_TABLE: [number, number, number, number][] = [
  [4, 3, 6, 6],
  [8, 7, 14, 28],
  [12, 11, 22, 66],
  [16, 15, 30, 120],
  [24, 23, 46, 276],
  [32, 31, 62, 496],
];

describe('parseEntrants', () => {
  it('reads one entrant per line with an optional team after a comma', () => {
    const entrants = parseEntrants('  Ana Souza, Atos \n\nBea Lima\nCris Park,  Alliance ');
    expect(entrants).toEqual([
      { id: 'competitor-1', name: 'Ana Souza', seed: 1, team: 'Atos' },
      { id: 'competitor-2', name: 'Bea Lima', seed: 2 },
      { id: 'competitor-3', name: 'Cris Park', seed: 3, team: 'Alliance' },
    ]);
    expect(formatEntrants(entrants)).toBe('Ana Souza, Atos\nBea Lima\nCris Park, Alliance');
  });

  it('caps the list at 64 entrants', () => {
    const text = Array.from({ length: 80 }, (_, i) => `P${i}`).join('\n');
    expect(parseEntrants(text)).toHaveLength(64);
  });
});

describe('shuffleLines', () => {
  it('keeps every entrant and drops blank lines', () => {
    let calls = 0;
    const out = shuffleLines('a\nb\n\nc\nd', () => [0.1, 0.7, 0.3][calls++ % 3]);
    expect(out.split('\n').sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('single elimination results', () => {
  const four = makePreviewCompetitors(4);

  it('advances a recorded winner into the next round', () => {
    // Seed order for 4 is [1,4,2,3]: m1 = 1 v 4, m2 = 2 v 3.
    const results: BracketResults = { 'se-r1-m1': 'b', 'se-r1-m2': 'a' };
    const bracket = buildBracket(four, 'single', { results });
    const final = bracket.sections[0].rounds[1].matches[0];
    expect(final.a?.name).toBe('Competitor 4');
    expect(final.b?.name).toBe('Competitor 2');
  });

  it('builds an IBJJF podium with two bronzes', () => {
    const results: BracketResults = { 'se-r1-m1': 'a', 'se-r1-m2': 'a', 'se-r2-m1': 'b' };
    const bracket = buildBracket(four, 'single', { results });
    const podium = singleEliminationPodium(bracket.sections[0]);
    expect(podium.gold?.name).toBe('Competitor 2');
    expect(podium.silver?.name).toBe('Competitor 1');
    expect(podium.bronze.map((c) => c.name).sort()).toEqual(['Competitor 3', 'Competitor 4']);
    expect(resultProgress(bracket)).toEqual({ decided: 3, total: 3 });
  });

  it('gives a three-person bracket a single bronze', () => {
    const results: BracketResults = { 'se-r1-m2': 'a', 'se-r2-m1': 'a' };
    const bracket = buildBracket(makePreviewCompetitors(3), 'single', { results });
    const podium = singleEliminationPodium(bracket.sections[0]);
    expect(podium.gold?.name).toBe('Competitor 1');
    expect(podium.silver?.name).toBe('Competitor 2');
    expect(podium.bronze.map((c) => c.name)).toEqual(['Competitor 3']);
  });

  it('clears later results on the path when an earlier one changes', () => {
    const results: BracketResults = { 'se-r1-m1': 'a', 'se-r1-m2': 'a', 'se-r2-m1': 'a' };
    const flipped = toggleResult(results, 'se-r1-m1', 'b');
    // Seed 4 now reaches the final, and the old final result (seed 1 won) is gone.
    expect(flipped).toEqual({ 'se-r1-m1': 'b', 'se-r1-m2': 'a' });
    const bracket = buildBracket(four, 'single', { results: flipped });
    expect(bracket.sections[0].rounds[1].matches[0].a?.name).toBe('Competitor 4');
    expect(bracket.sections[0].rounds[1].matches[0].winner).toBeUndefined();
  });

  it('clears the whole path in a deep bracket but leaves the other half', () => {
    const results: BracketResults = {
      'se-r1-m1': 'a',
      'se-r1-m2': 'a',
      'se-r1-m3': 'a',
      'se-r2-m1': 'a',
      'se-r2-m2': 'b',
      'se-r3-m1': 'a',
    };
    expect(toggleResult(results, 'se-r1-m1', 'a')).toEqual({
      'se-r1-m2': 'a',
      'se-r1-m3': 'a',
      'se-r2-m2': 'b',
    });
  });

  it('prunes results that no longer match a real contest', () => {
    const partial = buildBracket(four, 'single', { results: { 'se-r1-m2': 'a', 'se-r2-m1': 'b' } });
    expect(pruneResults(partial, { 'se-r1-m2': 'a', 'se-r2-m1': 'b' })).toEqual({ 'se-r1-m2': 'a' });
  });

  it('ignores results on byes', () => {
    const bracket = buildBracket(makePreviewCompetitors(3), 'single', {
      results: { 'se-r1-m1': 'b' },
    });
    expect(bracket.sections[0].rounds[0].matches[0].winner).toBeUndefined();
  });
});

describe('teammate separation', () => {
  it('moves a teammate out of a first-round clash', () => {
    // Seeds 1 and 4 meet in round one for a 4-person draw; make them teammates.
    const entrants = parseEntrants('A, Atos\nB, Alliance\nC, Checkmat\nD, Atos');
    const plain = buildBracket(entrants, 'single');
    expect(countTeammateClashes(plain)).toBe(1);
    const separated = buildBracket(entrants, 'single', { separateTeams: true });
    expect(countTeammateClashes(separated)).toBe(0);
    // Top seed keeps its place.
    expect(separated.sections[0].rounds[0].matches[0].a?.name).toBe('A');
  });

  it('never moves byes', () => {
    const entrants = parseEntrants('A, X\nB, X\nC, X');
    const seeded = buildBracket(entrants, 'single', { separateTeams: true });
    const first = seeded.sections[0].rounds[0].matches;
    expect(first[0].isBye).toBe(true);
    expect(first[0].a?.name).toBe('A');
  });

  it('leaves the draw alone when a swap cannot help', () => {
    const slots = parseEntrants('A, X\nB, X');
    expect(separateTeammates(slots)).toEqual(slots);
  });
});

describe('round robin standings', () => {
  it('ranks by wins, then losses, then seed', () => {
    const three = makePreviewCompetitors(3);
    const bracket = buildBracket(three, 'round_robin');
    const results: BracketResults = {};
    for (const round of bracket.sections[0].rounds) {
      for (const match of round.matches) {
        if (!match.a || !match.b) continue;
        // Lower seed number always wins.
        results[match.id] = match.a.seed < match.b.seed ? 'a' : 'b';
      }
    }
    const scored = buildBracket(three, 'round_robin', { results });
    const table = roundRobinStandings(scored.sections[0]);
    expect(table.map((r) => [r.competitor.name, r.wins, r.losses])).toEqual([
      ['Competitor 1', 2, 0],
      ['Competitor 2', 1, 1],
      ['Competitor 3', 0, 2],
    ]);
  });
});

describe('matchCounts', () => {
  it('matches the reference table on the page', () => {
    expect(matchCounts(16)).toEqual({ single: 15, double: 30, roundRobin: 120 });
    expect(matchCounts(12)).toEqual({ single: 11, double: 22, roundRobin: 66 });
    expect(matchCounts(1)).toEqual({ single: 0, double: 0, roundRobin: 0 });
  });

  it('agrees with the generated single-elimination draw', () => {
    for (const n of [2, 3, 5, 8, 12, 16, 24, 32]) {
      const bracket = buildBracket(makePreviewCompetitors(n), 'single');
      expect(resultProgress(bracket).total).toBe(matchCounts(n).single);
    }
  });

  it('matches the table printed on /brackets', () => {
    for (const [n, single, double, roundRobin] of MATCH_COUNT_TABLE) {
      expect(matchCounts(n)).toEqual({ single, double, roundRobin });
    }
  });

  it('matches the table in the README', () => {
    const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
    const rows = [...readme.matchAll(/^\| (\d+) \| (\d+) \| (\d+) \| (\d+) \|$/gm)].map((m) =>
      m.slice(1, 5).map(Number),
    );
    expect(rows).toEqual(MATCH_COUNT_TABLE);
  });

  it('agrees with the generated round robin', () => {
    for (const n of [3, 4, 7, 10]) {
      const bracket = buildBracket(makePreviewCompetitors(n), 'round_robin');
      expect(resultProgress(bracket).total).toBe(matchCounts(n).roundRobin);
    }
  });
});

describe('share hash', () => {
  it('round-trips names with accents and results', () => {
    const state = {
      style: 'single' as const,
      entrants: 'João Gonçalves, Atos\nZoë Ng',
      results: { 'se-r1-m1': 'a' as const },
      separateTeams: false,
    };
    const hash = encodeBracketHash(state);
    expect(hash).toMatch(/^b=[A-Za-z0-9_-]+$/);
    expect(decodeBracketHash(`#${hash}`)).toEqual(state);
  });

  it('rejects junk', () => {
    expect(decodeBracketHash('#b=not-base64!!')).toBeNull();
    expect(decodeBracketHash('#other=1')).toBeNull();
  });

  it('drops malformed result keys', () => {
    const hash = encodeBracketHash({
      style: 'round_robin',
      entrants: 'A\nB',
      results: { 'rr-r1-m1': 'b', '<script>': 'a' } as BracketResults,
      separateTeams: true,
    });
    expect(decodeBracketHash(hash)?.results).toEqual({ 'rr-r1-m1': 'b' });
  });
});

// Claims made in the README's reference sections.
describe('README claims', () => {
  const byeSeeds = (n: number) =>
    buildBracket(makePreviewCompetitors(n), 'single')
      .sections[0].rounds[0].matches.filter((m) => m.isBye)
      .map((m) => (m.a ?? m.b)!.seed)
      .sort((x, y) => x - y);

  it('gives the byes to the top seeds', () => {
    expect(byeSeeds(12)).toEqual([1, 2, 3, 4]);
    expect(byeSeeds(13)).toEqual([1, 2, 3]);
    expect(byeSeeds(16)).toEqual([]);
  });

  it('keeps seeds 1 and 2 apart until the final', () => {
    const first = buildBracket(makePreviewCompetitors(16), 'single').sections[0].rounds[0].matches;
    const half = first.length / 2;
    const top = first.slice(0, half).flatMap((m) => [m.a?.seed, m.b?.seed]);
    const bottom = first.slice(half).flatMap((m) => [m.a?.seed, m.b?.seed]);
    expect(top).toContain(1);
    expect(bottom).toContain(2);
  });

  it('sits one person out each round of an odd round robin', () => {
    const rounds = buildBracket(makePreviewCompetitors(5), 'round_robin').sections[0].rounds;
    expect(rounds).toHaveLength(5);
    for (const round of rounds) expect(round.matches.filter((m) => m.isBye)).toHaveLength(1);
  });
});

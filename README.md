# bjj-bracket

A free BJJ tournament bracket generator: single elimination, double elimination, and round robin, with teammates kept apart and an IBJJF-style podium.

Made by [Grapple Flows](https://grappleflows.com). Use it hosted at [grappleflows.com/brackets](https://grappleflows.com/brackets), or run it on your own site or in your own code.

This package has two parts:

- A **bracket library** with no dependencies and no DOM. It builds the draw, places byes, separates teammates, records winners, and works out the podium or the round robin standings. It runs in browsers, Node, Deno, and workers.
- A **`<bjj-bracket>` web component** built on the library, with no framework. Paste names and teams, pick a format, tap winners, and print.

It is the same bracket logic that runs the [Grapple Flows BJJ bracket generator](https://grappleflows.com/brackets).

## Quick start

Add the script and the element to any page. No build step.

```html
<script src="https://cdn.jsdelivr.net/npm/bjj-bracket@0/dist/bjj-bracket.min.js" defer></script>

<bjj-bracket></bjj-bracket>
```

unpkg works the same way: `https://unpkg.com/bjj-bracket@0/dist/bjj-bracket.min.js`.

To start with names already filled in, put one competitor per line in the `entrants` attribute, with the team after a comma:

```html
<bjj-bracket format="single" entrants="Alex Rivera, North Side BJJ
Sam Chen, Riverside Grappling
Jordan Diaz, North Side BJJ
Casey Morgan, Eastside Jiu-Jitsu"></bjj-bracket>
```

## Install from npm

```sh
npm install bjj-bracket
```

The package is ESM only, has no runtime dependencies, and ships TypeScript types.

| Import | What you get |
| --- | --- |
| `bjj-bracket` | The bracket library. No DOM, safe in Node and on the server. |
| `bjj-bracket/element` | The library plus the `<bjj-bracket>` element, registered on import. Browser only. |
| `bjj-bracket/bjj-bracket.min.js` | The script-tag build. Registers the element and exposes `window.BjjBracket`. |

### Library example

```js
import {
  parseEntrants,
  buildBracket,
  toggleResult,
  singleEliminationPodium,
} from "bjj-bracket";

const competitors = parseEntrants(`Ana Souza, Atos
Bea Lima, Alliance
Cris Park, Checkmat
Dani Rocha, Atos`);

// Seed order would put Ana (1) against Dani (4), both Atos. With
// separateTeams, Dani and Cris swap places, so round one is
// Ana v Cris and Bea v Dani.
let results = {};
let bracket = buildBracket(competitors, "single", { separateTeams: true });

results = toggleResult(results, "se-r1-m1", "a"); // Ana beats Cris
results = toggleResult(results, "se-r1-m2", "b"); // Dani beats Bea
results = toggleResult(results, "se-r2-m1", "a"); // Ana wins the final

bracket = buildBracket(competitors, "single", { results, separateTeams: true });
const podium = singleEliminationPodium(bracket.sections[0]);
// podium.gold.name === "Ana Souza", podium.silver.name === "Dani Rocha",
// podium.bronze.map((c) => c.name) → ["Cris Park", "Bea Lima"]
```

`buildBracket` is pure: pass it the competitors, the format, and the results so far, and it returns the whole bracket. Store `results` (a plain object of match id to `"a"` or `"b"`) and rebuild whenever it changes.

### Web component from npm

```js
import "bjj-bracket/element";

const el = document.querySelector("bjj-bracket");
el.addEventListener("bjj-bracket:complete", (event) => {
  console.log(event.detail.podium);
});
```

## Features

- Single elimination, double elimination, and round robin, for 2 to 64 competitors.
- Names and teams entered as plain text, one per line, in seed order.
- Byes placed on the top seeds when the entry count is not a power of two.
- Standard seeding, so seeds 1 and 2 can only meet in the final.
- Teammates kept apart in the first round, with a warning when there are not enough other teams to split them.
- Shuffle for a random draw when nobody is seeded.
- Tap a name to advance the winner. Tap again to undo. Changing a result clears the later results that depended on it.
- IBJJF-style podium: one gold, one silver, and two bronze medals.
- Round robin standings ranked by wins, then losses, then seed.
- Match counts for planning mat time.
- Print button that prints only the bracket, sized to fit the page.
- Optional save to `localStorage`, so a refresh does not lose a bracket in progress.
- Keyboard and screen reader support, mobile layout with sideways scrolling for wide brackets, and theming with CSS custom properties.

Double elimination shows the full draw (winners bracket, losers bracket, and grand final) for planning, and does not track results. This matches the hosted tool.

## Web component reference

### Attributes

| Attribute | Values | Default | What it does |
| --- | --- | --- | --- |
| `format` | `single`, `double`, `round_robin` (also `round-robin`, `double-elimination`, `single-elimination`) | `single` | Bracket format. |
| `entrants` | Text, one competitor per line, `Name, Team` | empty | Starting entrant list, in seed order. Empty shows a numbered preview. |
| `preview-size` | 2 to 64 | `8` | Size of the numbered preview shown when there are no names. |
| `separate-teams` | `true`, `false` | `true` | Keep teammates apart in the first round. |
| `storage-key` | Any string | none | Save the bracket to `localStorage` under this key and restore it on load. A saved bracket wins over the attributes. |
| `hide-controls` | Boolean | off | Hide the setup panel and show only the bracket. Winners can still be tapped. |
| `no-credit` | Boolean | off | Remove the credit link. See [Credit link](#credit-link). |

### Properties

| Property | Type | Notes |
| --- | --- | --- |
| `format` | `"single" \| "double" \| "round_robin"` | Read and write. |
| `entrants` | `string` | Read and write. Setting it generates a new draw and clears results if the list changed. |
| `previewSize` | `number` | Read and write. |
| `separateTeams` | `boolean` | Read and write. Changing it clears results, since the pairings change. |
| `results` | `Record<string, "a" \| "b">` | Read and write. Winners keyed by match id. |
| `state` | `BjjBracketState` | Read and write. Everything needed to save and restore a bracket, safe to `JSON.stringify`. |
| `competitors` | `Competitor[]` | Read only. |
| `bracket` | `Bracket` | Read only. The current bracket with results applied. |
| `podium` | `Podium \| null` | Read only. Single elimination. |
| `standings` | `StandingRow[] \| null` | Read only. Round robin. |
| `isComplete` | `boolean` | Read only. Every contest has a winner. Always `false` for double elimination. |

### Methods

| Method | What it does |
| --- | --- |
| `generate(entrants?)` | Build the draw from the given text, or from the text box when omitted. |
| `shuffle(random?)` | Shuffle the entrant order (and so the seeds) and clear results. `random` defaults to `Math.random`. |
| `toggleWinner(matchId, side)` | Record `"a"` or `"b"` as the winner, like tapping a name. Returns `false` if the match cannot take a result. |
| `clearResults()` | Remove every recorded winner. |
| `print()` | Print only the bracket from a hidden frame. Falls back to `window.print()`. |

### Events

All events bubble, cross the shadow boundary, and carry their data in `event.detail`.

| Event | When | `detail` |
| --- | --- | --- |
| `bjj-bracket:generate` | A new draw is built (Generate, Shuffle, format change, new entrants). | `{ format, competitors, bracket }` |
| `bjj-bracket:result` | A winner is recorded or cleared. | `{ matchId, side, winner, results, bracket }` (`side` is `null` when cleared) |
| `bjj-bracket:complete` | The last result is recorded in single elimination or round robin. | `{ format, bracket, results, podium, standings }` |
| `bjj-bracket:change` | Any change to the state. Useful for saving it yourself. | `{ state }` |

Match ids follow the round and match number: `se-r2-m1` is single elimination, round 2, match 1. Round robin uses `rr-`, and the double elimination losers bracket and grand final use `le-` and `gf-`.

### Theming

The element uses a shadow root, so page styles do not leak in or out. Set these custom properties on the element (or any ancestor) to theme it:

| Property | Default |
| --- | --- |
| `--bjj-bracket-accent` | `#7e0986` |
| `--bjj-bracket-accent-soft` | `rgba(126, 9, 134, 0.1)` |
| `--bjj-bracket-accent-contrast` | `#ffffff` |
| `--bjj-bracket-connector` | `rgba(126, 9, 134, 0.5)` |
| `--bjj-bracket-background` | `transparent` |
| `--bjj-bracket-surface` | `#ffffff` |
| `--bjj-bracket-surface-hover` | `#efede7` |
| `--bjj-bracket-well` | `#f1efe9` |
| `--bjj-bracket-text` | `#18181b` |
| `--bjj-bracket-text-muted` | `#52525b` |
| `--bjj-bracket-text-subtle` | `#71717a` |
| `--bjj-bracket-line` | `#e7e5e4` |
| `--bjj-bracket-line-strong` | `#d4d4d8` |
| `--bjj-bracket-win` | `#15803d` |
| `--bjj-bracket-warning-bg` | `rgba(180, 83, 9, 0.08)` |
| `--bjj-bracket-warning-text` | `#92400e` |
| `--bjj-bracket-radius` | `12px` |
| `--bjj-bracket-round-width` | `210px` |
| `--bjj-bracket-font` | inherits the page font |

A dark theme:

```css
bjj-bracket {
  --bjj-bracket-accent: #c77dff;
  --bjj-bracket-accent-contrast: #14121a;
  --bjj-bracket-accent-soft: rgba(199, 125, 255, 0.15);
  --bjj-bracket-connector: rgba(199, 125, 255, 0.5);
  --bjj-bracket-surface: #1c1a22;
  --bjj-bracket-surface-hover: #26232e;
  --bjj-bracket-well: #14121a;
  --bjj-bracket-text: #f4f4f5;
  --bjj-bracket-text-muted: #c4c4cc;
  --bjj-bracket-text-subtle: #9a9aa6;
  --bjj-bracket-line: #2e2b36;
  --bjj-bracket-line-strong: #3d3946;
  --bjj-bracket-win: #4ade80;
}
```

For deeper changes, these parts can be styled with `::part()`: `root`, `setup`, `format`, `entrants`, `button`, `generate`, `output`, `description`, `podium`, `standings`, `section`, `match`, `slot`, `credit`.

### Printing

The Print button copies the bracket (and the podium or standings) into a hidden frame and prints that, so the rest of your page does not end up on paper. Rounds shrink to fit the page width. If your visitors print the whole page instead, the element's print styles hide the setup panel and shrink the rounds the same way.

### Credit link

The element adds one small link under the bracket: "Free BJJ bracket generator by Grapple Flows", pointing to grappleflows.com/brackets. It is placed in the page's light DOM (as `<a slot="credit">` inside the element), not in the shadow root, so it is part of your page like any other link. It is on by default.

To hide it, add `no-credit`:

```html
<bjj-bracket no-credit></bjj-bracket>
```

The MIT license allows removing it, and nothing breaks if you do. If you keep it, it helps other gyms find the tool. You can also write the link in your own HTML, so it is there before the script runs, and the element will use yours instead of adding one:

```html
<bjj-bracket>
  <a slot="credit" href="https://grappleflows.com/brackets">Free BJJ bracket generator by Grapple Flows</a>
</bjj-bracket>
```

## Library reference

| Export | What it does |
| --- | --- |
| `buildBracket(competitors, style, { results?, separateTeams? })` | Builds the whole bracket: sections, rounds, matches, byes, and winners carried forward. |
| `parseEntrants(text)` | Reads `Name, Team` lines into competitors in seed order. Skips blank lines, trims, caps at 64. |
| `formatEntrants(competitors)` | The reverse of `parseEntrants`. |
| `shuffleLines(text, random?)` | Fisher-Yates shuffle of the lines, for a random draw. |
| `makePreviewCompetitors(count)` | Numbered placeholders: Competitor 1, Competitor 2, and so on. |
| `separateTeammates(slots)` | Rearranges first-round slots so teammates do not meet, where possible. |
| `countTeammateClashes(bracket)` | First-round matches that still pair teammates. |
| `toggleResult(results, matchId, side)` | Records or clears a winner, and clears later knockout results on that path. |
| `pruneResults(bracket, results)` | Drops results for matches that no longer have both competitors. |
| `singleEliminationPodium(section)` | Gold, silver, and the two semifinal losers as bronze. |
| `roundRobinStandings(section)` | Wins and losses table, sorted by wins, then losses, then seed. |
| `resultProgress(bracket)` | `{ decided, total }` contests, byes excluded. |
| `matchCounts(n)` | Matches needed for `n` competitors in each format. |
| `styleTakesResults(style)` | `true` for single elimination and round robin. |
| `encodeBracketHash(state)`, `decodeBracketHash(hash)` | Encode a bracket (format, entrants, results) into a URL hash and back, for share links that never reach a server. |
| `ELIMINATION_STYLES`, `ELIMINATION_STYLE_LABELS`, `ELIMINATION_STYLE_DESCRIPTIONS`, `MAX_ENTRANTS` | Constants. |

## How BJJ brackets work

The sections below explain the rules the generator follows. For a longer walkthrough of IBJJF brackets, seeding, and ranking points, see [How IBJJF brackets, BYEs, and rankings work](https://grappleflows.com/blog/how-ibjjf-brackets-byes-and-rankings-work/).

### How byes work in a BJJ bracket

A knockout bracket needs 2, 4, 8, 16, 32, or 64 slots. When the number of competitors falls between those sizes, the bracket rounds up to the next one, and the empty slots become byes. A bye means that competitor skips the first round and advances automatically.

Byes go to the top seeds. With 13 competitors the bracket has 16 slots, so there are 3 byes, and seeds 1, 2, and 3 get them. With 12 competitors there are 4 byes, and seeds 1 through 4 wait for the winners of the other first-round matches. At IBJJF events, seeds come from ranking points, so the highest-ranked athletes receive the byes.

Seeding also spreads the top seeds across the bracket. In a full bracket, seed 1 plays the lowest seed. Seed 2 is placed in the other half, and the two can only meet in the final.

### How teammates are kept apart

Most tournaments, IBJJF included, try to keep people from the same academy from meeting early. When you add a team after each name, the generator checks every first-round pair. If two teammates are drawn together, the lower seed of the pair is swapped with the closest-seeded competitor from another pair, as long as the swap does not create a new teammate clash. Team names are compared without regard to capital letters.

Top seeds and their byes never move. If a division has too many people from one team to split them all, the generator keeps the draw it has and shows a warning with the number of first-round matches that still pair teammates. Round robin does not separate teams, since everyone faces everyone.

### Why IBJJF has two bronze medals

IBJJF tournaments do not run a third-place match. Both competitors who lose in the semifinals are awarded third place, so each division hands out one gold, one silver, and two bronze medals. The podium in this package follows the same rule. A three-person bracket has only one semifinal, so it has one bronze.

### Single vs double elimination vs round robin for an in-house tournament

- **Single elimination.** Lose once and you are out. It is the format IBJJF uses and the fastest to run: always one fewer match than the number of competitors. Use it for divisions of six or more when mat time is short.
- **Double elimination.** A first loss drops you into the losers bracket, and you are out only after a second loss. The winners and losers brackets meet in a grand final. Everyone gets at least two matches, which is why it is popular at local tournaments, but it runs about twice as many matches as single elimination.
- **Round robin.** Everyone faces everyone else once, and placement comes down to overall record. It suits small divisions of three to five, where a knockout bracket would give some people only one match. Grappling Industries events are known for this format. With an odd number of competitors, one person sits out each round.

For an in-house tournament, split competitors by belt and weight first and make one bracket per division. Round robin works well for three to five people, and single elimination for anything larger.

### How many matches are in a bracket

Use this to plan mat time. Multiply the match count by your match length, plus a minute or two for resets between matches.

| Competitors | Single elimination | Double elimination | Round robin |
| --- | --- | --- | --- |
| 4 | 3 | 6 | 6 |
| 8 | 7 | 14 | 28 |
| 12 | 11 | 22 | 66 |
| 16 | 15 | 30 | 120 |
| 24 | 23 | 46 | 276 |
| 32 | 31 | 62 | 496 |

Single elimination is always `n - 1` matches. Double elimination is `2n - 2`, assuming the grand final is not reset. With a reset, add one match. Round robin is `n × (n - 1) / 2`.

## Demo

[`demo/index.html`](demo/index.html) is a working page. Run `npm install && npm run build`, then serve the folder with any static file server and open `/demo/`. The hosted version, with share links, is at [grappleflows.com/brackets](https://grappleflows.com/brackets).

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

The build writes `dist/index.js` (library), `dist/bjj-bracket.js` (library plus element, ESM), `dist/bjj-bracket.min.js` (script tag), and type declarations.

## Related

- [bjj-timer](https://github.com/GrappleFlows/bjj-timer): a BJJ round timer.
- [bjj-scoreboard](https://github.com/GrappleFlows/bjj-scoreboard): a BJJ scoreboard.
- [bjj-data](https://github.com/GrappleFlows/bjj-data): IBJJF and ADCC weight classes, age divisions, legal techniques, and belt requirements as JSON and TypeScript.

## About Grapple Flows

Grapple Flows is a free BJJ flowchart app that turns voice notes and videos into visual maps of jiu-jitsu techniques, positions, and transitions you can study, edit, and share.

- Website: [grappleflows.com](https://grappleflows.com)
- Free BJJ tools, including the bracket generator, round timer, and scoreboard: [grappleflows.com/tools](https://grappleflows.com/tools)

## License

[MIT](LICENSE). Copyright (c) 2026 Grapple Flows.

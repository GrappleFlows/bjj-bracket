// Styles for <bjj-bracket>. They live in the shadow root, so the host page's
// CSS cannot break the bracket and the bracket cannot leak styles out. Theme it
// from the outside with the --bjj-bracket-* custom properties listed in
// THEME_PROPERTIES (they inherit through the shadow boundary), or with ::part().

/** Public custom properties, with their defaults. */
export const THEME_PROPERTIES: Record<string, string> = {
  '--bjj-bracket-accent': '#7e0986',
  '--bjj-bracket-accent-soft': 'rgba(126, 9, 134, 0.1)',
  '--bjj-bracket-accent-contrast': '#ffffff',
  '--bjj-bracket-connector': 'rgba(126, 9, 134, 0.5)',
  '--bjj-bracket-background': 'transparent',
  '--bjj-bracket-surface': '#ffffff',
  '--bjj-bracket-surface-hover': '#efede7',
  '--bjj-bracket-well': '#f1efe9',
  '--bjj-bracket-text': '#18181b',
  '--bjj-bracket-text-muted': '#52525b',
  '--bjj-bracket-text-subtle': '#71717a',
  '--bjj-bracket-line': '#e7e5e4',
  '--bjj-bracket-line-strong': '#d4d4d8',
  '--bjj-bracket-win': '#15803d',
  '--bjj-bracket-warning-bg': 'rgba(180, 83, 9, 0.08)',
  '--bjj-bracket-warning-text': '#92400e',
  '--bjj-bracket-radius': '12px',
  '--bjj-bracket-round-width': '210px',
};

const v = (name: string): string => `var(${name}, ${THEME_PROPERTIES[name]})`;

export const STYLES = /* css */ `
:host {
  display: block;
  color: ${v('--bjj-bracket-text')};
  background: ${v('--bjj-bracket-background')};
  font-family: var(--bjj-bracket-font);
  line-height: 1.4;
  -webkit-text-size-adjust: 100%;
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }

.root, .output { display: grid; gap: 20px; min-width: 0; }

/* ---- Setup ---------------------------------------------------------------- */
.setup {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 16px;
  display: grid;
  gap: 14px;
  background: ${v('--bjj-bracket-surface')};
  border: 1px solid ${v('--bjj-bracket-line')};
  border-radius: ${v('--bjj-bracket-radius')};
}
:host([hide-controls]) .setup { display: none; }

.format {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  padding: 4px;
  border-radius: 10px;
  background: ${v('--bjj-bracket-well')};
}
.format button {
  min-height: 40px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: ${v('--bjj-bracket-text-muted')};
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.format button[aria-checked='true'] {
  background: ${v('--bjj-bracket-surface')};
  border-color: ${v('--bjj-bracket-line')};
  color: ${v('--bjj-bracket-text')};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.field { display: grid; gap: 6px; }
.field[hidden], .check[hidden], .btn[hidden] { display: none; }
.label {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${v('--bjj-bracket-text-subtle')};
}
textarea, input[type='number'] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid ${v('--bjj-bracket-line-strong')};
  border-radius: 10px;
  background: ${v('--bjj-bracket-surface')};
  color: ${v('--bjj-bracket-text')};
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
}
textarea { min-height: 150px; resize: vertical; }
textarea:focus, input[type='number']:focus {
  outline: none;
  border-color: ${v('--bjj-bracket-accent')};
  box-shadow: 0 0 0 3px ${v('--bjj-bracket-accent-soft')};
}
.field--inline { grid-template-columns: 1fr 96px; align-items: center; }

.meta {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: ${v('--bjj-bracket-text-subtle')};
}

.check {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 14px;
  cursor: pointer;
}
.check input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: ${v('--bjj-bracket-accent')};
}

.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid ${v('--bjj-bracket-line-strong')};
  border-radius: 999px;
  background: ${v('--bjj-bracket-surface')};
  color: ${v('--bjj-bracket-text')};
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.btn:hover:not(:disabled) { background: ${v('--bjj-bracket-surface-hover')}; }
.btn:disabled { opacity: 0.45; cursor: default; }
.btn--primary {
  border-color: ${v('--bjj-bracket-accent')};
  background: ${v('--bjj-bracket-accent')};
  color: ${v('--bjj-bracket-accent-contrast')};
}
.btn--primary:hover:not(:disabled) { background: ${v('--bjj-bracket-accent')}; filter: brightness(1.1); }
.btn svg { width: 16px; height: 16px; flex: none; }

.toast { margin: 0; min-height: 0; font-size: 14px; color: ${v('--bjj-bracket-text-muted')}; }
.toast:empty { display: none; }

button:focus-visible, .rounds:focus-visible {
  outline: 2px solid ${v('--bjj-bracket-accent')};
  outline-offset: 2px;
}

/* ---- Notes ---------------------------------------------------------------- */
.description {
  max-width: 640px;
  margin: 0 auto;
  color: ${v('--bjj-bracket-text-muted')};
  font-size: 0.95rem;
  line-height: 1.5;
  text-align: center;
}
.warning {
  max-width: 640px;
  margin: 0 auto;
  padding: 10px 14px;
  border-radius: 10px;
  background: ${v('--bjj-bracket-warning-bg')};
  color: ${v('--bjj-bracket-warning-text')};
  font-size: 14px;
}

/* ---- Results -------------------------------------------------------------- */
.podium {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  border: 1px solid ${v('--bjj-bracket-line')};
  border-radius: ${v('--bjj-bracket-radius')};
  background: ${v('--bjj-bracket-surface')};
  overflow: hidden;
}
.podium-row {
  display: grid;
  grid-template-columns: 76px 1fr;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid ${v('--bjj-bracket-line')};
  font-weight: 600;
}
.podium-row:first-child { border-top: 0; }
.medal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${v('--bjj-bracket-text-subtle')};
}
.medal::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--medal);
}
.podium-row[data-medal='gold'] { --medal: #d99e1f; }
.podium-row[data-medal='silver'] { --medal: #a1a1aa; }
.podium-row[data-medal='bronze'] { --medal: #a9663a; }

.standings { width: 100%; max-width: 640px; margin: 0 auto; }
.table-wrap {
  overflow-x: auto;
  border: 1px solid ${v('--bjj-bracket-line')};
  border-radius: ${v('--bjj-bracket-radius')};
  background: ${v('--bjj-bracket-surface')};
}
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 14px; text-align: left; border-top: 1px solid ${v('--bjj-bracket-line')}; }
thead th {
  border-top: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${v('--bjj-bracket-text-subtle')};
}
td:first-child, th:first-child, td:nth-child(n + 3), th:nth-child(n + 3) {
  width: 3.5em;
  font-variant-numeric: tabular-nums;
}

/* ---- Bracket -------------------------------------------------------------- */
.section-title { margin: 0 0 16px; font-size: 1.1rem; font-weight: 700; }
.sections { display: grid; gap: 36px; min-width: 0; }
.section { min-width: 0; }
.empty { margin: 0; color: ${v('--bjj-bracket-text-subtle')}; font-style: italic; }

/* Rounds are columns that scroll sideways on narrow screens. */
.rounds {
  display: flex;
  gap: 28px;
  overflow-x: auto;
  padding: 4px 2px 10px;
  -webkit-overflow-scrolling: touch;
  align-items: stretch;
}
.round {
  flex: 0 0 auto;
  width: ${v('--bjj-bracket-round-width')};
  display: flex;
  flex-direction: column;
}
.round-name {
  margin: 0 0 12px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${v('--bjj-bracket-text-subtle')};
}
.round-matches { display: flex; flex-direction: column; gap: 16px; flex: 1; }
.match-wrap { display: flex; flex-direction: column; justify-content: center; }

.match {
  position: relative;
  border: 1px solid ${v('--bjj-bracket-line')};
  border-radius: 14px;
  background: ${v('--bjj-bracket-surface')};
  padding: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
.match[data-decided='true'] { border-color: ${v('--bjj-bracket-line-strong')}; }

.slot {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border-radius: 8px;
  font-size: 0.9rem;
  color: inherit;
}
.seed {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  border-radius: 8px;
  background: ${v('--bjj-bracket-accent')};
  color: ${v('--bjj-bracket-accent-contrast')};
  font-size: 0.72rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.seed--empty { background: ${v('--bjj-bracket-well')}; }
.slot-text { display: grid; min-width: 0; flex: 1; }
.name, .team { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.team { font-size: 0.75rem; color: ${v('--bjj-bracket-text-subtle')}; }
.slot--empty { color: ${v('--bjj-bracket-text-subtle')}; font-style: italic; font-size: 0.85rem; }
.slot--pick {
  min-height: 44px;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
}
.slot--pick:hover { background: ${v('--bjj-bracket-surface-hover')}; }
.slot[data-state='won'] .name { font-weight: 700; }
.slot[data-state='lost'] { opacity: 0.45; }
.check-icon { width: 16px; height: 16px; flex: none; color: ${v('--bjj-bracket-win')}; }

.vs {
  display: block;
  width: fit-content;
  margin: 1px auto;
  padding: 1px 8px;
  border-radius: 999px;
  background: ${v('--bjj-bracket-accent-soft')};
  color: ${v('--bjj-bracket-accent')};
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Connector lines, knockout trees only: each round has half the matches of
   the one before, so matches are spread over the column height and joined
   with a stub out of each match, a vertical between the pair, and an arm into
   the next round. */
.rounds--connected .round-matches { gap: 0; }
.rounds--connected .match-wrap { position: relative; flex: 1; padding: 8px 0; }
.rounds--connected .match-wrap::before,
.rounds--connected .match-wrap::after { background: ${v('--bjj-bracket-connector')}; }
.rounds--connected .is-feeder::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -14px;
  width: 14px;
  height: 2px;
}
.rounds--connected .is-feeder.is-top::before {
  content: '';
  position: absolute;
  top: 50%;
  right: -15px;
  width: 2px;
  height: 100%;
}
.rounds--connected .is-feeder.is-bottom::before {
  content: '';
  position: absolute;
  top: 0;
  right: -28px;
  width: 14px;
  height: 2px;
}

/* ---- Credit --------------------------------------------------------------- */
.credit { text-align: center; font-size: 12px; }
::slotted(a) { color: ${v('--bjj-bracket-text-subtle')}; }

@media (max-width: 480px) {
  .format button { font-size: 13px; }
  .actions .btn { flex: 1 1 auto; justify-content: center; }
}

@media (prefers-reduced-motion: no-preference) {
  .format button, .btn, .slot--pick { transition: background 180ms ease; }
}

/* ---- Print ---------------------------------------------------------------
   The page's own print (Ctrl+P) hides the controls and shrinks the rounds to
   fit the page width. The Print button prints only the bracket, from a
   separate frame, using these same rules. */
@media print {
  .setup, .toast, .description, .warning { display: none !important; }
  .root { gap: 12px; }
  .rounds { overflow: visible; gap: 14px; }
  .round { width: auto; min-width: 0; flex: 1 1 0; }
  .match { box-shadow: none; break-inside: avoid; }
  .slot { padding: 3px 4px; font-size: 9pt; }
  .slot--pick { min-height: 0; font-size: 9pt; }
  .section { break-inside: avoid-page; }
  .seed { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

/** Extra rules for the standalone print document the Print button opens. */
export const PRINT_DOCUMENT_STYLES = /* css */ `
@page { margin: 12mm; }
html, body { margin: 0; background: #fff; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #18181b; }
.print-title { margin: 0 0 4px; font-size: 16pt; }
.print-meta { margin: 0 0 12px; font-size: 9pt; color: #52525b; }
.print-credit { margin: 16px 0 0; font-size: 8pt; color: #71717a; text-align: center; }
.print-credit a { color: inherit; }
`;

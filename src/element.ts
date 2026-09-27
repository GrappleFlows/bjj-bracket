// <bjj-bracket>: a framework-free custom element around the bracket library.
//
// Everything visual lives in a shadow root. The one exception is the credit
// link, which is a normal light-DOM child (slotted into the footer) so it is
// part of the host page's HTML for search engines and other crawlers.

import {
  buildBracket,
  countTeammateClashes,
  makePreviewCompetitors,
  matchCounts,
  parseEntrants,
  pruneResults,
  resultProgress,
  roundRobinStandings,
  shuffleLines,
  singleEliminationPodium,
  styleTakesResults,
  toggleResult,
  ELIMINATION_STYLES,
  ELIMINATION_STYLE_DESCRIPTIONS,
  ELIMINATION_STYLE_LABELS,
  MAX_ENTRANTS,
  type Bracket,
  type BracketMatch,
  type BracketResults,
  type Competitor,
  type EliminationStyle,
  type MatchSide,
  type Podium,
  type StandingRow,
} from './brackets.js';
import { PRINT_DOCUMENT_STYLES, STYLES, THEME_PROPERTIES } from './styles.js';

export const TAG_NAME = 'bjj-bracket';

export const CREDIT_URL =
  'https://grappleflows.com/brackets?utm_source=github&utm_medium=referral&utm_campaign=bjj-bracket&ref=github';
export const CREDIT_TEXT = 'Free BJJ bracket generator by Grapple Flows';

const MIN_PREVIEW = 2;
const DEFAULT_PREVIEW = 8;

/** Everything needed to restore a bracket. Safe to JSON.stringify. */
export interface BjjBracketState {
  format: EliminationStyle;
  /** Entrant list, one per line, team after a comma. Empty = numbered preview. */
  entrants: string;
  /** Size of the numbered preview used when `entrants` is empty. */
  previewSize: number;
  results: BracketResults;
  separateTeams: boolean;
}

export interface BjjBracketGenerateDetail {
  format: EliminationStyle;
  competitors: Competitor[];
  bracket: Bracket;
}

export interface BjjBracketResultDetail {
  matchId: string;
  /** The side now recorded as the winner, or null when the result was cleared. */
  side: MatchSide | null;
  winner: Competitor | null;
  results: BracketResults;
  bracket: Bracket;
}

export interface BjjBracketCompleteDetail {
  format: EliminationStyle;
  bracket: Bracket;
  results: BracketResults;
  /** Single elimination only. */
  podium: Podium | null;
  /** Round robin only. */
  standings: StandingRow[] | null;
}

export interface BjjBracketChangeDetail {
  state: BjjBracketState;
}

export interface BjjBracketEventMap {
  'bjj-bracket:generate': CustomEvent<BjjBracketGenerateDetail>;
  'bjj-bracket:result': CustomEvent<BjjBracketResultDetail>;
  'bjj-bracket:complete': CustomEvent<BjjBracketCompleteDetail>;
  'bjj-bracket:change': CustomEvent<BjjBracketChangeDetail>;
}

const SHORT_LABELS: Record<EliminationStyle, string> = {
  single: 'Single',
  double: 'Double',
  round_robin: 'Round robin',
};

const FORMAT_ALIASES: Record<string, EliminationStyle> = {
  single: 'single',
  'single-elimination': 'single',
  single_elimination: 'single',
  double: 'double',
  'double-elimination': 'double',
  double_elimination: 'double',
  round_robin: 'round_robin',
  'round-robin': 'round_robin',
  roundrobin: 'round_robin',
};

/** Read a format name, accepting a few spellings (`round-robin`, `double-elimination`). */
export function parseFormat(value: string | null | undefined): EliminationStyle | null {
  if (!value) return null;
  return FORMAT_ALIASES[value.trim().toLowerCase()] ?? null;
}

const clampPreview = (value: number): number =>
  Number.isNaN(value)
    ? DEFAULT_PREVIEW
    : Math.min(MAX_ENTRANTS, Math.max(MIN_PREVIEW, Math.floor(value)));

const esc = (text: string): string =>
  text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

const ICONS = {
  check:
    '<svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>',
  shuffle:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/></svg>',
  reset:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>',
  print:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>',
};

// Lets the module load where HTMLElement does not exist (Node, SSR, tests
// without a DOM). Defining the element is still skipped there.
const BaseElement: typeof HTMLElement =
  typeof HTMLElement === 'undefined'
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

let instanceCount = 0;

export class BjjBracketElement extends BaseElement {
  static get observedAttributes(): string[] {
    return ['format', 'entrants', 'preview-size', 'separate-teams', 'no-credit'];
  }

  private _state: BjjBracketState = {
    format: 'single',
    entrants: '',
    previewSize: DEFAULT_PREVIEW,
    results: {},
    separateTeams: true,
  };
  private _bracket: Bracket = { style: 'single', sections: [] };
  private _competitors: Competitor[] = [];
  private _root: ShadowRoot | null = null;
  private _connected = false;
  private _restored = false;
  private _toastTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly _uid = `bjj-bracket-${++instanceCount}`;

  // --- lifecycle -------------------------------------------------------------

  connectedCallback(): void {
    if (!this._root) {
      this._root = this.attachShadow({ mode: 'open' });
      this._root.innerHTML = this._shellHtml();
      this._bindControls();
    }
    this._connected = true;
    if (!this._restored) {
      this._restored = true;
      this._readAttributes();
      this._restoreFromStorage();
      const textarea = this._q<HTMLTextAreaElement>('textarea');
      if (textarea) textarea.value = this._state.entrants;
    }
    this._syncCredit();
    this._rebuild();
    this._render();
  }

  disconnectedCallback(): void {
    this._connected = false;
    if (this._toastTimer) clearTimeout(this._toastTimer);
  }

  attributeChangedCallback(name: string, oldValue: string | null, value: string | null): void {
    if (oldValue === value || !this._restored) return;
    switch (name) {
      case 'format': {
        const format = parseFormat(value);
        if (format) this.format = format;
        break;
      }
      case 'entrants':
        this.entrants = value ?? '';
        break;
      case 'preview-size':
        this.previewSize = Number(value);
        break;
      case 'separate-teams':
        this.separateTeams = value !== 'false';
        break;
      case 'no-credit':
        this._syncCredit();
        break;
      default:
        break;
    }
  }

  // --- public properties -----------------------------------------------------

  /** `single`, `double`, or `round_robin`. */
  get format(): EliminationStyle {
    return this._state.format;
  }
  set format(value: EliminationStyle) {
    const format = parseFormat(value);
    if (!format || format === this._state.format) return;
    this._state.format = format;
    this._update({ generated: true });
  }

  /** The entrant list in use: one per line, team after a comma, seed order. */
  get entrants(): string {
    return this._state.entrants;
  }
  set entrants(value: string) {
    this.generate(value ?? '');
  }

  /** Size of the numbered preview bracket shown when there are no names. */
  get previewSize(): number {
    return this._state.previewSize;
  }
  set previewSize(value: number) {
    const size = clampPreview(Number(value));
    if (size === this._state.previewSize) return;
    this._state.previewSize = size;
    if (!this._state.entrants.trim()) this._state.results = {};
    const input = this._q<HTMLInputElement>('input[type="number"]');
    if (input) input.value = String(size);
    this._update({ generated: !this._state.entrants.trim() });
  }

  /** Keep teammates apart in the first round (on by default). */
  get separateTeams(): boolean {
    return this._state.separateTeams;
  }
  set separateTeams(value: boolean) {
    const next = Boolean(value);
    if (next === this._state.separateTeams) return;
    this._state.separateTeams = next;
    // The pairings change, so earlier knockout results no longer line up.
    this._state.results = {};
    this._update({ generated: true });
  }

  /** Recorded winners keyed by match id. Setting it replaces them. */
  get results(): BracketResults {
    return { ...this._state.results };
  }
  set results(value: BracketResults) {
    this._state.results = { ...(value ?? {}) };
    this._update({});
  }

  /** The full state, for saving and restoring a bracket. */
  get state(): BjjBracketState {
    return { ...this._state, results: { ...this._state.results } };
  }
  set state(value: Partial<BjjBracketState>) {
    const format = parseFormat(value.format) ?? this._state.format;
    this._state = {
      format,
      entrants: typeof value.entrants === 'string' ? value.entrants : this._state.entrants,
      previewSize:
        value.previewSize !== undefined ? clampPreview(Number(value.previewSize)) : this._state.previewSize,
      results: value.results ? { ...value.results } : {},
      separateTeams:
        value.separateTeams !== undefined ? Boolean(value.separateTeams) : this._state.separateTeams,
    };
    const textarea = this._q<HTMLTextAreaElement>('textarea');
    if (textarea) textarea.value = this._state.entrants;
    const input = this._q<HTMLInputElement>('input[type="number"]');
    if (input) input.value = String(this._state.previewSize);
    this._update({ generated: true });
  }

  /** Competitors in the current draw (numbered placeholders when no names). */
  get competitors(): Competitor[] {
    return this._competitors.map((c) => ({ ...c }));
  }

  /** The current bracket, with recorded results applied. */
  get bracket(): Bracket {
    return this._bracket;
  }

  /** Gold, silver, and two bronzes, once a single-elimination final is decided. */
  get podium(): Podium | null {
    if (this._state.format !== 'single') return null;
    const section = this._bracket.sections[0];
    return section ? singleEliminationPodium(section) : null;
  }

  /** Wins and losses table for round robin. */
  get standings(): StandingRow[] | null {
    if (this._state.format !== 'round_robin') return null;
    const section = this._bracket.sections[0];
    return section ? roundRobinStandings(section) : null;
  }

  /** Every contest (byes excluded) has a winner. Double elimination never completes. */
  get isComplete(): boolean {
    if (!styleTakesResults(this._state.format)) return false;
    const { decided, total } = resultProgress(this._bracket);
    return total > 0 && decided === total;
  }

  // --- public methods --------------------------------------------------------

  /** Build the draw from `entrants` (or the text box when omitted). Results are
   *  cleared when the list changes. */
  generate(entrants?: string): Bracket {
    const textarea = this._q<HTMLTextAreaElement>('textarea');
    const text = entrants ?? textarea?.value ?? this._state.entrants;
    if (text !== this._state.entrants) this._state.results = {};
    this._state.entrants = text;
    if (textarea && textarea.value !== text) textarea.value = text;
    this._update({ generated: true });
    return this._bracket;
  }

  /** Random draw: shuffle the entrant order (and so the seeds), clear results. */
  shuffle(random: () => number = Math.random): void {
    const textarea = this._q<HTMLTextAreaElement>('textarea');
    const text = textarea?.value ?? this._state.entrants;
    if (!text.trim()) return;
    const shuffled = shuffleLines(text, random);
    this._state.entrants = shuffled;
    this._state.results = {};
    if (textarea) textarea.value = shuffled;
    this._update({ generated: true });
    this._toast('Seeds shuffled. Results cleared.');
  }

  /** Record `side` as the winner of `matchId`, like tapping a name. Doing it
   *  again clears the result, and changing a knockout result clears the later
   *  results that depended on it. Returns false when the match is not a live
   *  contest (a bye, an undecided slot, or double elimination). */
  toggleWinner(matchId: string, side: MatchSide): boolean {
    if (!styleTakesResults(this._state.format)) return false;
    const match = this._findMatch(matchId);
    if (!match || !match.a || !match.b) return false;
    const wasComplete = this.isComplete;
    const next = toggleResult(this._state.results, matchId, side);
    const rebuilt = this._build(next);
    this._state.results = pruneResults(rebuilt, next);
    this._update({});
    const recorded = this._state.results[matchId] ?? null;
    const updated = this._findMatch(matchId);
    this._emit('bjj-bracket:result', {
      matchId,
      side: recorded,
      winner: recorded && updated ? (recorded === 'a' ? updated.a : updated.b) : null,
      results: this.results,
      bracket: this._bracket,
    });
    if (!wasComplete && this.isComplete) {
      this._emit('bjj-bracket:complete', {
        format: this._state.format,
        bracket: this._bracket,
        results: this.results,
        podium: this.podium,
        standings: this.standings,
      });
    }
    return true;
  }

  clearResults(): void {
    if (Object.keys(this._state.results).length === 0) return;
    this._state.results = {};
    this._update({});
    this._toast('Results cleared.');
  }

  /** Print just the bracket, from a hidden frame, so the host page's layout
   *  does not matter. Falls back to printing the page. */
  print(): void {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc || !doc.body) return;
    let frame: HTMLIFrameElement | null = null;
    try {
      frame = doc.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
      doc.body.appendChild(frame);
      const win = frame.contentWindow;
      const fdoc = frame.contentDocument ?? win?.document;
      if (!win || !fdoc || typeof win.print !== 'function') throw new Error('no print frame');
      fdoc.open();
      fdoc.write(this._printDocumentHtml());
      fdoc.close();
      const cleanup = () => {
        setTimeout(() => frame?.remove(), 500);
      };
      win.addEventListener('afterprint', cleanup, { once: true });
      win.focus();
      win.print();
      setTimeout(() => frame?.remove(), 60_000);
    } catch {
      frame?.remove();
      if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
    }
  }

  // --- internals -------------------------------------------------------------

  private _q<T extends Element>(selector: string): T | null {
    return (this._root?.querySelector(selector) as T | null) ?? null;
  }

  private _readAttributes(): void {
    const format = parseFormat(this.getAttribute('format'));
    if (format) this._state.format = format;
    const entrants = this.getAttribute('entrants');
    if (entrants !== null) this._state.entrants = entrants;
    const preview = this.getAttribute('preview-size');
    if (preview !== null) this._state.previewSize = clampPreview(Number(preview));
    const separate = this.getAttribute('separate-teams');
    if (separate !== null) this._state.separateTeams = separate !== 'false';
  }

  private _storageKey(): string | null {
    const key = this.getAttribute('storage-key');
    return key && key.trim() ? key.trim() : null;
  }

  private _restoreFromStorage(): void {
    const key = this._storageKey();
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<BjjBracketState> & { v?: number };
      if (saved.v !== 1) return;
      const format = parseFormat(saved.format);
      if (format) this._state.format = format;
      if (typeof saved.entrants === 'string') this._state.entrants = saved.entrants;
      if (typeof saved.previewSize === 'number') this._state.previewSize = clampPreview(saved.previewSize);
      if (typeof saved.separateTeams === 'boolean') this._state.separateTeams = saved.separateTeams;
      if (saved.results && typeof saved.results === 'object') {
        const results: BracketResults = {};
        for (const [id, side] of Object.entries(saved.results)) {
          if (side === 'a' || side === 'b') results[id] = side;
        }
        this._state.results = results;
      }
    } catch {
      /* storage unavailable or corrupt */
    }
  }

  private _save(): void {
    const key = this._storageKey();
    if (!key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ v: 1, ...this._state }));
    } catch {
      /* storage unavailable */
    }
  }

  private _competitorsFor(): Competitor[] {
    return this._state.entrants.trim()
      ? parseEntrants(this._state.entrants)
      : makePreviewCompetitors(this._state.previewSize);
  }

  private _build(results: BracketResults): Bracket {
    const hasTeams = this._competitors.some((c) => c.team);
    return buildBracket(this._competitors, this._state.format, {
      results: styleTakesResults(this._state.format) ? results : {},
      separateTeams: this._state.separateTeams && hasTeams,
    });
  }

  private _rebuild(): void {
    this._competitors = this._competitorsFor();
    this._bracket = this._build(this._state.results);
  }

  private _update({ generated }: { generated?: boolean }): void {
    this._rebuild();
    if (this._connected) this._render();
    this._save();
    if (generated) {
      this._emit('bjj-bracket:generate', {
        format: this._state.format,
        competitors: this.competitors,
        bracket: this._bracket,
      });
    }
    this._emit('bjj-bracket:change', { state: this.state });
  }

  private _emit<K extends keyof BjjBracketEventMap>(
    type: K,
    detail: BjjBracketEventMap[K]['detail'],
  ): void {
    if (typeof CustomEvent === 'undefined') return;
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  private _findMatch(matchId: string): BracketMatch | null {
    for (const section of this._bracket.sections) {
      for (const round of section.rounds) {
        for (const match of round.matches) {
          if (match.id === matchId) return match;
        }
      }
    }
    return null;
  }

  private _toast(message: string): void {
    const toast = this._q<HTMLElement>('.toast');
    if (!toast) return;
    toast.textContent = message;
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.textContent = '';
    }, 2800);
  }

  /** The credit is a light-DOM <a slot="credit">. An existing one written in
   *  the page's HTML is kept as is. `no-credit` removes the one we added. */
  private _syncCredit(): void {
    const existing = Array.from(this.children).find((el) => el.getAttribute('slot') === 'credit');
    if (this.hasAttribute('no-credit')) {
      if (existing && existing.hasAttribute('data-bjj-bracket-credit')) existing.remove();
      return;
    }
    if (existing) return;
    const link = document.createElement('a');
    link.setAttribute('slot', 'credit');
    link.setAttribute('href', CREDIT_URL);
    link.setAttribute('data-bjj-bracket-credit', '');
    link.textContent = CREDIT_TEXT;
    this.appendChild(link);
  }

  private _shellHtml(): string {
    const id = this._uid;
    const formats = ELIMINATION_STYLES.map(
      (s) =>
        `<button type="button" role="radio" data-format="${s}" aria-checked="false" tabindex="-1">${SHORT_LABELS[s]}</button>`,
    ).join('');
    return `<style>${STYLES}</style>
<div class="root" part="root">
  <div class="setup" part="setup">
    <div class="format" role="radiogroup" aria-label="Bracket format" part="format">${formats}</div>
    <div class="field">
      <label class="label" for="${id}-entrants">Competitors, in seed order</label>
      <textarea id="${id}-entrants" rows="6" spellcheck="false" autocomplete="off" part="entrants"
        aria-describedby="${id}-hint"
        placeholder="One per line. Add a team after a comma.&#10;Alex Rivera, North Side BJJ&#10;Sam Chen, Riverside Grappling"></textarea>
    </div>
    <div class="field field--inline" data-role="preview">
      <label class="label" for="${id}-preview">Or preview a bracket size</label>
      <input id="${id}-preview" type="number" inputmode="numeric" min="${MIN_PREVIEW}" max="${MAX_ENTRANTS}" />
    </div>
    <label class="check" data-role="teams">
      <input type="checkbox" />
      Keep teammates apart in the first round
    </label>
    <div class="actions">
      <button type="button" class="btn btn--primary" data-action="generate" part="button generate">Generate bracket</button>
      <button type="button" class="btn" data-action="shuffle" part="button">${ICONS.shuffle}Shuffle</button>
      <button type="button" class="btn" data-action="clear" part="button">${ICONS.reset}Clear results</button>
      <button type="button" class="btn" data-action="print" part="button">${ICONS.print}Print</button>
    </div>
    <p class="meta" id="${id}-hint"></p>
    <p class="toast" role="status" aria-live="polite"></p>
  </div>
  <div class="output" part="output"></div>
  <div class="credit" part="credit"><slot name="credit"></slot></div>
</div>`;
  }

  private _bindControls(): void {
    const root = this._root;
    if (!root) return;

    const group = root.querySelector('.format');
    group?.addEventListener('click', (event) => {
      const button = (event.target as Element).closest('button[data-format]');
      if (button) this.format = button.getAttribute('data-format') as EliminationStyle;
    });
    group?.addEventListener('keydown', (event) => {
      const e = event as KeyboardEvent;
      const step =
        e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const index = ELIMINATION_STYLES.indexOf(this._state.format);
      const next = ELIMINATION_STYLES[(index + step + ELIMINATION_STYLES.length) % ELIMINATION_STYLES.length];
      this.format = next;
      this._q<HTMLButtonElement>(`button[data-format="${next}"]`)?.focus();
    });

    const textarea = this._q<HTMLTextAreaElement>('textarea');
    textarea?.addEventListener('input', () => this._renderControls());
    textarea?.addEventListener('keydown', (event) => {
      const e = event as KeyboardEvent;
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.generate();
      }
    });

    this._q<HTMLInputElement>('input[type="number"]')?.addEventListener('change', (event) => {
      this.previewSize = Number((event.target as HTMLInputElement).value);
    });

    this._q<HTMLInputElement>('[data-role="teams"] input')?.addEventListener('change', (event) => {
      this.separateTeams = (event.target as HTMLInputElement).checked;
    });

    root.querySelector('.actions')?.addEventListener('click', (event) => {
      const button = (event.target as Element).closest('button[data-action]');
      switch (button?.getAttribute('data-action')) {
        case 'generate':
          this.generate();
          break;
        case 'shuffle':
          this.shuffle();
          break;
        case 'clear':
          this.clearResults();
          break;
        case 'print':
          this.print();
          break;
        default:
          break;
      }
    });

    root.querySelector('.output')?.addEventListener('click', (event) => {
      const slot = (event.target as Element).closest('button[data-match]');
      if (!slot) return;
      const matchId = slot.getAttribute('data-match') ?? '';
      const side = slot.getAttribute('data-side') as MatchSide;
      this.toggleWinner(matchId, side);
      // The output was re-rendered; keep focus on the same slot.
      this._q<HTMLButtonElement>(`button[data-match="${matchId}"][data-side="${side}"]`)?.focus();
    });
  }

  private _renderControls(): void {
    const { format, entrants, previewSize, separateTeams, results } = this._state;
    const hasTeams = this._competitors.some((c) => c.team);
    const takesResults = styleTakesResults(format);
    const textarea = this._q<HTMLTextAreaElement>('textarea');
    const pending = textarea ? textarea.value : entrants;
    const edited = pending !== entrants;

    for (const button of Array.from(this._root?.querySelectorAll('button[data-format]') ?? [])) {
      const selected = button.getAttribute('data-format') === format;
      button.setAttribute('aria-checked', String(selected));
      button.setAttribute('tabindex', selected ? '0' : '-1');
    }

    const preview = this._q<HTMLElement>('[data-role="preview"]');
    if (preview) preview.hidden = Boolean(pending.trim());
    const previewInput = this._q<HTMLInputElement>('input[type="number"]');
    if (previewInput && this._root?.activeElement !== previewInput && previewInput.value !== String(previewSize)) {
      previewInput.value = String(previewSize);
    }

    const teams = this._q<HTMLElement>('[data-role="teams"]');
    if (teams) teams.hidden = !hasTeams || format === 'round_robin';
    const checkbox = this._q<HTMLInputElement>('[data-role="teams"] input');
    if (checkbox) checkbox.checked = separateTeams;

    const shuffle = this._q<HTMLButtonElement>('[data-action="shuffle"]');
    if (shuffle) shuffle.disabled = !pending.trim();
    const clear = this._q<HTMLButtonElement>('[data-action="clear"]');
    if (clear) {
      clear.hidden = !takesResults;
      clear.disabled = Object.keys(results).length === 0 || resultProgress(this._bracket).decided === 0;
    }

    const counts = matchCounts(this._competitors.length);
    const matchTotal = format === 'single' ? counts.single : format === 'double' ? counts.double : counts.roundRobin;
    const progress = resultProgress(this._bracket);
    let meta = `${this._competitors.length} competitors · ${matchTotal} matches`;
    if (takesResults && progress.total > 0) meta += ` · ${progress.decided} of ${progress.total} decided`;
    if (edited) meta += ' · List edited. Generate to update the bracket.';
    const metaEl = this._q<HTMLElement>('.meta');
    if (metaEl) metaEl.textContent = meta;
  }

  private _render(): void {
    this._renderControls();
    const output = this._q<HTMLElement>('.output');
    if (output) output.innerHTML = this._outputHtml(true);
  }

  private _outputHtml(interactive: boolean): string {
    const { format } = this._state;
    const takesResults = styleTakesResults(format);
    const hasTeams = this._competitors.some((c) => c.team);
    const parts: string[] = [];

    if (interactive) {
      parts.push(
        `<p class="description" part="description">${esc(ELIMINATION_STYLE_DESCRIPTIONS[format])} ${
          takesResults
            ? 'Tap a name to mark the winner. Tap again to undo.'
            : 'Results are not tracked for double elimination. Use it to plan the draw.'
        }</p>`,
      );
      const clashes =
        this._state.separateTeams && hasTeams && format !== 'round_robin'
          ? countTeammateClashes(this._bracket)
          : 0;
      if (clashes > 0) {
        parts.push(
          `<p class="warning" role="note">${
            clashes === 1 ? 'One first-round match still pairs' : `${clashes} first-round matches still pair`
          } teammates. There are not enough other teams to split them.</p>`,
        );
      }
    }

    const podium = this.podium;
    if (podium?.gold) {
      const rows = [
        `<div class="podium-row" data-medal="gold"><span class="medal">Gold</span><span>${esc(podium.gold.name)}</span></div>`,
      ];
      if (podium.silver) {
        rows.push(
          `<div class="podium-row" data-medal="silver"><span class="medal">Silver</span><span>${esc(podium.silver.name)}</span></div>`,
        );
      }
      for (const c of podium.bronze) {
        rows.push(
          `<div class="podium-row" data-medal="bronze"><span class="medal">Bronze</span><span>${esc(c.name)}</span></div>`,
        );
      }
      parts.push(`<section class="podium" part="podium" aria-label="Podium">${rows.join('')}</section>`);
    }

    const standings = this.standings;
    if (standings && standings.length > 0) {
      const rows = standings
        .map(
          (row, i) =>
            `<tr><td>${i + 1}</td><td>${esc(row.competitor.name)}</td><td>${row.wins}</td><td>${row.losses}</td></tr>`,
        )
        .join('');
      parts.push(
        `<section class="standings" part="standings" aria-labelledby="${this._uid}-standings"><h3 class="section-title" id="${this._uid}-standings">Standings</h3><div class="table-wrap"><table><thead><tr><th scope="col">#</th><th scope="col">Competitor</th><th scope="col"><abbr title="Wins">W</abbr></th><th scope="col"><abbr title="Losses">L</abbr></th></tr></thead><tbody>${rows}</tbody></table></div></section>`,
      );
    }

    const sections = this._bracket.sections.map((section, si) => {
      // Connector lines only make sense for a clean knockout tree, where each
      // round has exactly half the matches of the one before it.
      const isKnockoutTree =
        section.rounds.length > 1 &&
        section.rounds.every(
          (r, i) => i === 0 || r.matches.length === section.rounds[i - 1].matches.length / 2,
        );
      const lastRound = section.rounds.length - 1;
      const pickable = interactive && takesResults && si === 0;
      const title = `<h3 class="section-title">${esc(section.title)}</h3>`;
      if (section.rounds.length === 0) {
        return `<section class="section">${title}<p class="empty">Not enough competitors to build a bracket.</p></section>`;
      }
      const rounds = section.rounds
        .map((round, ri) => {
          const matches = round.matches
            .map((match, mi) => {
              const classes = ['match-wrap'];
              if (isKnockoutTree && ri < lastRound) classes.push('is-feeder', mi % 2 === 0 ? 'is-top' : 'is-bottom');
              const contest = Boolean(match.a && match.b);
              return `<div class="${classes.join(' ')}"><div class="match" part="match" data-decided="${match.winner ? 'true' : 'false'}">${this._slotHtml(
                match,
                'a',
                pickable && contest,
              )}<span class="vs" aria-hidden="true">vs</span>${this._slotHtml(match, 'b', pickable && contest)}</div></div>`;
            })
            .join('');
          return `<div class="round"><h4 class="round-name">${esc(round.name)}</h4><div class="round-matches">${matches}</div></div>`;
        })
        .join('');
      const scrollLabel = `${section.title}${interactive ? ', scrolls sideways' : ''}`;
      return `<section class="section" part="section">${title}<div class="rounds${
        isKnockoutTree ? ' rounds--connected' : ''
      }" role="region" aria-label="${esc(scrollLabel)}"${interactive ? ' tabindex="0"' : ''}>${rounds}</div></section>`;
    });
    parts.push(`<div class="sections">${sections.join('')}</div>`);
    return parts.join('');
  }

  private _slotHtml(match: BracketMatch, side: MatchSide, pickable: boolean): string {
    const competitor = match[side];
    if (!competitor) {
      return `<div class="slot slot--empty"><span class="seed seed--empty" aria-hidden="true"></span><span class="name">${
        match.isBye ? 'Bye' : 'TBD'
      }</span></div>`;
    }
    const state = !match.winner ? 'open' : match.winner === side ? 'won' : 'lost';
    const body = `<span class="seed" title="Seed ${competitor.seed}">${competitor.seed}</span><span class="slot-text"><span class="name">${esc(
      competitor.name,
    )}</span>${competitor.team ? `<span class="team">${esc(competitor.team)}</span>` : ''}</span>${
      state === 'won' ? ICONS.check : ''
    }`;
    if (!pickable) {
      return `<div class="slot" data-state="${state}">${body}</div>`;
    }
    return `<button type="button" class="slot slot--pick" part="slot" data-state="${state}" data-match="${esc(
      match.id,
    )}" data-side="${side}" aria-pressed="${state === 'won'}" aria-label="${esc(competitor.name)} wins">${body}</button>`;
  }

  private _printDocumentHtml(): string {
    const computed = typeof getComputedStyle === 'function' ? getComputedStyle(this) : null;
    const vars = Object.keys(THEME_PROPERTIES)
      .map((name) => {
        const value = computed?.getPropertyValue(name).trim();
        return value ? `${name}: ${value};` : '';
      })
      .join(' ');
    const css = STYLES.replace(/:host\b/g, ':root');
    const { format } = this._state;
    const credit = this.hasAttribute('no-credit')
      ? ''
      : `<p class="print-credit">Made with the free BJJ bracket generator at <a href="${esc(CREDIT_URL)}">grappleflows.com/brackets</a></p>`;
    return `<!doctype html><html lang="en" style="${esc(vars)}"><head><meta charset="utf-8"><title>BJJ bracket</title><style>${css}${PRINT_DOCUMENT_STYLES}</style></head><body><div class="root"><div><h1 class="print-title">${esc(
      ELIMINATION_STYLE_LABELS[format],
    )}</h1><p class="print-meta">${this._competitors.length} competitors</p></div>${this._outputHtml(false)}</div>${credit}</body></html>`;
  }
}

/** Register `<bjj-bracket>` (or a custom tag name). Safe to call twice and a
 *  no-op where custom elements are not available. */
export function defineBjjBracket(tagName: string = TAG_NAME): void {
  if (typeof customElements === 'undefined') return;
  if (customElements.get(tagName)) return;
  customElements.define(
    tagName,
    tagName === TAG_NAME ? BjjBracketElement : class extends BjjBracketElement {},
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'bjj-bracket': BjjBracketElement;
  }
  interface HTMLElementEventMap {
    'bjj-bracket:generate': CustomEvent<BjjBracketGenerateDetail>;
    'bjj-bracket:result': CustomEvent<BjjBracketResultDetail>;
    'bjj-bracket:complete': CustomEvent<BjjBracketCompleteDetail>;
    'bjj-bracket:change': CustomEvent<BjjBracketChangeDetail>;
  }
}

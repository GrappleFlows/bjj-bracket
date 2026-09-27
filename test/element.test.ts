// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BjjBracketElement,
  CREDIT_TEXT,
  CREDIT_URL,
  defineBjjBracket,
  type BjjBracketCompleteDetail,
  type BjjBracketGenerateDetail,
} from '../src/bjj-bracket.js';

beforeAll(() => defineBjjBracket());

afterEach(() => {
  document.body.innerHTML = '';
  window.localStorage.clear();
});

function mount(attrs: Record<string, string> = {}): BjjBracketElement {
  const el = document.createElement('bjj-bracket');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

const shadow = (el: BjjBracketElement) => el.shadowRoot!;
const pickButtons = (el: BjjBracketElement) =>
  Array.from(shadow(el).querySelectorAll<HTMLButtonElement>('button[data-match]'));
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));

describe('<bjj-bracket>', () => {
  it('registers once and upgrades', () => {
    defineBjjBracket();
    expect(customElements.get('bjj-bracket')).toBe(BjjBracketElement);
    expect(mount()).toBeInstanceOf(BjjBracketElement);
  });

  it('renders an 8-person preview by default', () => {
    const el = mount();
    expect(el.competitors).toHaveLength(8);
    expect(shadow(el).querySelectorAll('.match')).toHaveLength(7);
    expect(shadow(el).querySelector('.meta')?.textContent).toContain('8 competitors · 7 matches');
  });

  it('puts the credit link in the light DOM', () => {
    const el = mount();
    const link = el.querySelector(':scope > a[slot="credit"]') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toBe(CREDIT_URL);
    expect(link.textContent).toBe(CREDIT_TEXT);
    expect(shadow(el).querySelector('slot[name="credit"]')).not.toBeNull();
  });

  it('hides the credit with no-credit, and keeps a hand-written one', () => {
    const hidden = mount({ 'no-credit': '' });
    expect(hidden.querySelector('[slot="credit"]')).toBeNull();

    const shown = mount();
    shown.setAttribute('no-credit', '');
    expect(shown.querySelector('[slot="credit"]')).toBeNull();
    shown.removeAttribute('no-credit');
    expect(shown.querySelector('[slot="credit"]')).not.toBeNull();

    const own = document.createElement('bjj-bracket');
    own.innerHTML = '<a slot="credit" href="https://grappleflows.com/brackets">Bracket by Grapple Flows</a>';
    document.body.appendChild(own);
    expect(own.querySelectorAll('[slot="credit"]')).toHaveLength(1);
    expect(own.querySelector('[slot="credit"]')?.textContent).toBe('Bracket by Grapple Flows');
  });

  it('generates from the text box and fires bjj-bracket:generate', () => {
    const el = mount();
    const events: BjjBracketGenerateDetail[] = [];
    el.addEventListener('bjj-bracket:generate', (e) => events.push(e.detail));
    const textarea = shadow(el).querySelector('textarea')!;
    textarea.value = 'Ana, Atos\nBea, Alliance\nCris, Checkmat\nDani, Atos';
    textarea.dispatchEvent(new Event('input'));
    expect(shadow(el).querySelector('.meta')?.textContent).toContain('Generate to update');
    click(shadow(el).querySelector('[data-action="generate"]')!);
    expect(events).toHaveLength(1);
    expect(events[0].competitors.map((c) => c.name)).toEqual(['Ana', 'Bea', 'Cris', 'Dani']);
    // Ana and Dani (both Atos) would meet in round one; they are split.
    const first = el.bracket.sections[0].rounds[0].matches;
    for (const m of first) expect(m.a?.team && m.a.team === m.b?.team).toBeFalsy();
    expect(shadow(el).textContent).toContain('Atos');
  });

  it('reads entrants and format from attributes', () => {
    const el = mount({ format: 'round-robin', entrants: 'A\nB\nC' });
    expect(el.format).toBe('round_robin');
    expect(el.bracket.sections[0].rounds).toHaveLength(3);
    el.setAttribute('format', 'double');
    expect(el.bracket.sections.map((s) => s.title)).toEqual([
      'Winners bracket',
      'Losers bracket',
      'Grand final',
    ]);
  });

  it('advances winners on tap and fires bjj-bracket:complete with an IBJJF podium', () => {
    const el = mount({ entrants: 'A\nB\nC\nD' });
    const results: string[] = [];
    const complete: BjjBracketCompleteDetail[] = [];
    el.addEventListener('bjj-bracket:result', (e) => results.push(e.detail.matchId));
    el.addEventListener('bjj-bracket:complete', (e) => complete.push(e.detail));

    // Round one: A v D and B v C. Top seed wins each.
    const slot = (id: string, side: 'a' | 'b') =>
      shadow(el).querySelector<HTMLButtonElement>(`button[data-match="${id}"][data-side="${side}"]`)!;
    click(slot('se-r1-m1', 'a'));
    click(slot('se-r1-m2', 'a'));
    expect(el.bracket.sections[0].rounds[1].matches[0].a?.name).toBe('A');
    expect(complete).toHaveLength(0);

    const finalB = slot('se-r2-m1', 'b');
    expect(finalB.getAttribute('aria-label')).toBe('B wins');
    click(finalB);

    expect(results).toEqual(['se-r1-m1', 'se-r1-m2', 'se-r2-m1']);
    expect(complete).toHaveLength(1);
    expect(complete[0].podium?.gold?.name).toBe('B');
    expect(complete[0].podium?.silver?.name).toBe('A');
    expect(complete[0].podium?.bronze.map((c) => c.name).sort()).toEqual(['C', 'D']);
    const medals = Array.from(shadow(el).querySelectorAll('.podium-row')).map((r) => r.getAttribute('data-medal'));
    expect(medals).toEqual(['gold', 'silver', 'bronze', 'bronze']);
    expect(el.isComplete).toBe(true);

    // Tapping the winner again undoes it.
    el.toggleWinner('se-r2-m1', 'b');
    expect(el.results['se-r2-m1']).toBeUndefined();
    expect(el.isComplete).toBe(false);
  });

  it('shows round robin standings', () => {
    const el = mount({ format: 'round_robin', entrants: 'A\nB\nC' });
    for (const round of el.bracket.sections[0].rounds) {
      for (const m of round.matches) {
        if (m.a && m.b) el.toggleWinner(m.id, m.a.seed < m.b.seed ? 'a' : 'b');
      }
    }
    const rows = Array.from(shadow(el).querySelectorAll('.standings tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent),
    );
    expect(rows).toEqual([
      ['1', 'A', '2', '0'],
      ['2', 'B', '1', '1'],
      ['3', 'C', '0', '2'],
    ]);
    expect(el.isComplete).toBe(true);
  });

  it('does not take results in double elimination', () => {
    const el = mount({ format: 'double', entrants: 'A\nB\nC\nD' });
    expect(pickButtons(el)).toHaveLength(0);
    expect(el.toggleWinner('se-r1-m1', 'a')).toBe(false);
  });

  it('escapes names', () => {
    const el = mount({ entrants: '<img src=x onerror=alert(1)>, <b>Team</b>\nB' });
    expect(shadow(el).querySelector('img')).toBeNull();
    expect(shadow(el).querySelector('.output b')).toBeNull();
    expect(shadow(el).textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('shuffles with an injected random and clears results', () => {
    const el = mount({ entrants: 'A\nB\nC\nD' });
    el.toggleWinner('se-r1-m1', 'a');
    el.shuffle(() => 0);
    expect(el.results).toEqual({});
    expect(el.entrants.split('\n').sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(el.entrants).not.toBe('A\nB\nC\nD');
  });

  it('saves to and restores from storage-key', () => {
    const first = mount({ 'storage-key': 'test-bracket', entrants: 'A\nB' });
    first.toggleWinner('se-r1-m1', 'b');
    first.remove();
    const second = mount({ 'storage-key': 'test-bracket' });
    expect(second.entrants).toBe('A\nB');
    expect(second.podium?.gold?.name).toBe('B');
  });

  it('round-trips state', () => {
    const el = mount();
    el.state = { format: 'single', entrants: 'A\nB\nC', results: { 'se-r1-m2': 'a' } };
    expect(el.state).toMatchObject({ format: 'single', entrants: 'A\nB\nC', results: { 'se-r1-m2': 'a' } });
    expect(shadow(el).querySelector('textarea')!.value).toBe('A\nB\nC');
  });

  it('switches format with arrow keys on the radio group', () => {
    const el = mount();
    const group = shadow(el).querySelector('[role="radiogroup"]')!;
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.format).toBe('double');
    const checked = shadow(el).querySelector('[role="radio"][aria-checked="true"]');
    expect(checked?.getAttribute('data-format')).toBe('double');
    expect(checked?.getAttribute('tabindex')).toBe('0');
  });

  it('prints without throwing', () => {
    const el = mount({ entrants: 'A\nB' });
    const pagePrint = vi.fn();
    Object.defineProperty(window, 'print', { value: pagePrint, configurable: true, writable: true });
    expect(() => el.print()).not.toThrow();
    // Either the isolated frame printed, or it fell back to the page.
    const frame = document.querySelector('iframe');
    expect(Boolean(frame) || pagePrint.mock.calls.length === 1).toBe(true);
  });
});

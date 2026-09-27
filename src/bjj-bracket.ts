// Browser entry: the bracket library plus the <bjj-bracket> element, which is
// registered on import. Built as dist/bjj-bracket.js (ESM) and
// dist/bjj-bracket.min.js (script tag, exposes window.BjjBracket).

import { defineBjjBracket } from './element.js';

export * from './brackets.js';
export {
  BjjBracketElement,
  CREDIT_TEXT,
  CREDIT_URL,
  TAG_NAME,
  defineBjjBracket,
  parseFormat,
  type BjjBracketChangeDetail,
  type BjjBracketCompleteDetail,
  type BjjBracketEventMap,
  type BjjBracketGenerateDetail,
  type BjjBracketResultDetail,
  type BjjBracketState,
} from './element.js';
export { THEME_PROPERTIES } from './styles.js';

defineBjjBracket();

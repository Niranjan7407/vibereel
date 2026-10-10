import { parseClaude } from './parsers/claude.js';
import { parseCodex } from './parsers/codex.js';
import { redactTimeline, trimTimeline } from './redact.js';
import { storyboard } from './storyboard.js';
import { renderHtml, type Aspect, type Theme } from './html.js';
import { detectSource } from './sessions.js';
import type { Source, Timeline } from './types.js';

export { parseClaude, parseCodex, redactTimeline, trimTimeline, storyboard, renderHtml };
export type { Timeline, Source };
export type { Reel, Scene } from './storyboard.js';

export function parseSession(text: string, file = '', source?: Source): Timeline {
  const src = source ?? detectSource(file, text);
  return src === 'codex' ? parseCodex(text) : parseClaude(text);
}

export interface BuildOptions { redact?: boolean; duration?: number; theme?: Theme; aspect?: Aspect; home?: string }

/** text of a session file -> { timeline, reel, html } */
export function build(text: string, file = '', o: BuildOptions = {}) {
  let tl = parseSession(text, file);
  tl = trimTimeline(tl);
  if (o.redact !== false) tl = redactTimeline(tl, { home: o.home });
  const reel = storyboard(tl, { duration: o.duration });
  return { timeline: tl, reel, html: renderHtml(reel, { theme: o.theme, aspect: o.aspect }) };
}

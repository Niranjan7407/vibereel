import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseClaude } from '../src/parsers/claude';
import { parseCodex, patchToEdits } from '../src/parsers/codex';
import { parseSession } from '../src/index';
import { isTestCommand, lineDiff, makeTitle } from '../src/normalize';

const demo = fs.readFileSync(new URL('../fixtures/demo-dark-mode.jsonl', import.meta.url), 'utf8');
const codex = fs.readFileSync(new URL('../fixtures/codex-sample.jsonl', import.meta.url), 'utf8');

describe('claude parser', () => {
  const tl = parseClaude(demo);
  it('reads the prompt, project and model', () => {
    expect(tl.source).toBe('claude');
    expect(tl.project).toBe('todo-app');
    expect(tl.events[0]).toMatchObject({ kind: 'prompt' });
    expect(tl.stats.model).toBe('claude-opus-4-6');
    expect(tl.title).toBe('Add a dark mode to the todo app.');
  });
  it('turns Edit/Write into diffs with relative paths', () => {
    const edits = tl.events.filter((e) => e.kind === 'edit');
    expect(edits.map((e) => e.kind === 'edit' && e.path)).toContain('src/hooks/useTheme.ts');
    const created = edits.find((e) => e.kind === 'edit' && e.path === 'src/hooks/useTheme.ts')!;
    expect(created.kind === 'edit' && created.created && created.removed === 0).toBe(true);
  });
  it('detects the red -> green test run', () => {
    const tests = tl.events.filter((e) => e.kind === 'command' && e.isTest);
    expect(tests.map((e) => e.kind === 'command' && e.testState)).toEqual(['fail', 'pass']);
    expect(tests[1].kind === 'command' && tests[1].redToGreen).toBe(true);
  });
  it('turns TodoWrite into a plan and strips line numbers from reads', () => {
    expect(tl.events.find((e) => e.kind === 'thinking')).toBeTruthy();
    const read = tl.events.find((e) => e.kind === 'read');
    expect(read?.kind === 'read' && read.preview?.[0]).toBe("import { Header } from './components/Header';");
  });
  it('sums usage once per message id and estimates cost', () => {
    expect(tl.stats.tokens).toBeGreaterThan(50_000);
    expect(tl.stats.costUsd).toBeGreaterThan(0.5);
    expect(tl.stats.durationMs).toBe(47.2 * 60000);
    expect(tl.tokensAt.length).toBe(tl.events.length);
  });
  it('skips meta, sidechain and tool-result-only user lines', () => {
    const extra = [
      { type: 'user', isMeta: true, timestamp: '2026-10-08T09:12:05Z', message: { role: 'user', content: 'meta' } },
      { type: 'user', isSidechain: true, timestamp: '2026-10-08T09:12:05Z', message: { role: 'user', content: 'side' } },
      { type: 'user', timestamp: '2026-10-08T09:12:05Z', message: { role: 'user', content: '<command-name>/review</command-name><command-args>auth</command-args>' } },
      'not json',
    ].map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
    const t = parseClaude(demo + extra);
    const prompts = t.events.filter((e) => e.kind === 'prompt').map((e) => e.kind === 'prompt' && e.text);
    expect(prompts).toContain('/review auth');
    expect(prompts).not.toContain('meta');
    expect(prompts).not.toContain('side');
  });
  it('throws on files with no messages', () => {
    expect(() => parseClaude('{"type":"summary"}\n')).toThrow();
  });
});

describe('codex parser', () => {
  const tl = parseCodex(codex);
  it('reads meta, skips environment context', () => {
    expect(tl.source).toBe('codex');
    expect(tl.project).toBe('api');
    expect(tl.stats.model).toBe('gpt-5-codex');
    const prompts = tl.events.filter((e) => e.kind === 'prompt');
    expect(prompts).toHaveLength(1);
  });
  it('handles exec_command, shell and apply_patch inside JS', () => {
    const cmds = tl.events.filter((e) => e.kind === 'command');
    expect(cmds.map((c) => c.kind === 'command' && c.command)).toEqual(['pytest -q', 'pytest -q']);
    expect(cmds.map((c) => c.kind === 'command' && c.testState)).toEqual(['fail', 'pass']);
    expect(cmds[1].kind === 'command' && cmds[1].redToGreen).toBe(true);
    expect(cmds[0].kind === 'command' && cmds[0].output.join('\n')).not.toMatch(/Wall time/);
    const edits = tl.events.filter((e) => e.kind === 'edit');
    expect(edits.map((e) => e.kind === 'edit' && e.path)).toEqual(['app/page.py', 'tests/test_edge.py']);
  });
  it('uses reasoning summaries and token_count totals', () => {
    expect(tl.events.find((e) => e.kind === 'thinking')).toMatchObject({ text: 'Looking at pagination first' });
    expect(tl.stats.usage.cacheRead).toBe(40000);
    expect(tl.stats.usage.input).toBe(12000);
  });
  it('auto-detects the source', () => {
    expect(parseSession(codex, 'rollout-x.jsonl').source).toBe('codex');
    expect(parseSession(demo, 'abc.jsonl').source).toBe('claude');
  });
  it('parses patches with moves and deletes', () => {
    const ev = patchToEdits('*** Begin Patch\n*** Delete File: a.txt\n*** Update File: b.txt\n*** Move to: c.txt\n@@\n-x\n+y\n*** End Patch', 0);
    expect(ev[0]).toMatchObject({ kind: 'tool', name: 'delete' });
    expect(ev[1]).toMatchObject({ kind: 'edit', path: 'c.txt', added: 1, removed: 1 });
  });
});

describe('helpers', () => {
  it('diffs lines', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc').map((d) => d.op).join('')).toBe(' -+ ');
  });
  it('recognises test commands', () => {
    for (const c of ['npm test', 'pnpm run test', 'npx vitest run', 'pytest -q', 'cargo test', 'go test ./...', 'cd api && python -m pytest'])
      expect(isTestCommand(c), c).toBe(true);
    for (const c of ['npm run build', 'git commit -m "test it"', 'ls tests'])
      expect(isTestCommand(c), c).toBe(false);
  });
  it('makes titles', () => {
    expect(makeTitle('Fix the login bug. Then deploy.')).toBe('Fix the login bug.');
    expect(makeTitle('', 'configure-claude-defaults')).toBe('Configure claude defaults');
  });
});

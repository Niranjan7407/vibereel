import { describe, expect, it } from 'vitest';
import { MASK, clipLines, isEnvPath, redactEnvBody, redactPaths, redactSecrets, redactTimeline, trimTimeline } from '../src/redact';
import { parseCodex } from '../src/parsers/codex';
import fs from 'node:fs';

describe('paths', () => {
  it('turns the home dir into ~', () => {
    expect(redactPaths('/Users/jane/code/app/x.ts', '/Users/jane')).toBe('~/code/app/x.ts');
    expect(redactPaths('cd /home/bob/proj && ls', '/Users/jane')).toBe('cd ~/proj && ls');
    expect(redactPaths('C:\\Users\\bob\\proj', '/x')).toBe('~\\proj');
  });
});

describe('secrets', () => {
  const cases: [string, string][] = [
    ['anthropic', 'key sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv'],
    ['openai', 'sk-proj-abcdefghijklmnopqrstuvwx1234'],
    ['github', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
    ['fine-grained github', 'github_pat_11ABCDEFG0123456789_abcdefghijklmnop'],
    ['aws', 'AKIAIOSFODNN7EXAMPLE'],
    ['slack', 'xoxb-123456789012-abcdefghij'],
    ['stripe', 'sk_live_51Habcdefghijklmn'],
    ['google', 'AIza' + 'SyA-1234567890abcdefghijklmnopqrstu'],
    ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'],
    ['bearer', 'Authorization: Bearer abcdef0123456789abcdef'],
    ['huggingface', 'hf_abcdefghijklmnopqrstuvwxyzABCDEF'],
    ['npm', 'npm_abcdefghijklmnopqrstuvwxyz0123456789'],
  ];
  for (const [name, s] of cases) {
    it(`masks ${name}`, () => {
      const out = redactSecrets(s);
      expect(out).toContain(MASK);
      const secret = s.split(/\s/).pop()!;
      expect(out).not.toContain(secret);
    });
  }
  it('masks emails', () => {
    expect(redactSecrets('ping jane.doe+x@example.co.uk now')).toBe(`ping ${MASK}@${MASK} now`);
  });
  it('masks credentials in URLs', () => {
    expect(redactSecrets('postgres://admin:hunter2@db:5432/x')).toBe(`postgres://${MASK}@db:5432/x`);
  });
  it('masks env-style and quoted assignments', () => {
    expect(redactSecrets('export OPENAI_API_KEY=abc123')).toBe(`export OPENAI_API_KEY=${MASK}`);
    expect(redactSecrets('DB_PASSWORD="p@ss word"')).not.toContain('p@ss');
    expect(redactSecrets('{"apiKey": "zz9-plural-z-alpha"}')).toBe(`{"apiKey": "${MASK}"}`);
    expect(redactSecrets('const token = `abcdef123456`')).toContain(MASK);
  });
  it('masks private keys', () => {
    const k = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----';
    expect(redactSecrets(k)).toBe(MASK);
  });
  it('leaves normal prose and code alone', () => {
    const s = 'the token count is 212k tokens: fine. Use password managers. const x = getToken(user);';
    expect(redactSecrets(s)).toBe(s);
    expect(redactSecrets('import { useTheme } from "./hooks"')).toBe('import { useTheme } from "./hooks"');
  });
  it('blanks every value in .env files', () => {
    expect(isEnvPath('app/.env.local')).toBe(true);
    expect(isEnvPath('src/env.ts')).toBe(false);
    expect(redactEnvBody('PORT=3000\nNAME=demo\n# comment')).toBe(`PORT=${MASK}\nNAME=${MASK}\n# comment`);
  });
});

describe('timeline redaction', () => {
  const tl = parseCodex(fs.readFileSync(new URL('../fixtures/codex-sample.jsonl', import.meta.url), 'utf8'));
  it('redacts prompts, commands and cwd', () => {
    const r = redactTimeline(tl, { home: '/home/sam' });
    const json = JSON.stringify(r);
    expect(json).not.toContain('sk-proj-abcdefghijklmnopqrstuvwx123456');
    expect(json).not.toContain('/home/sam');
    expect(r.cwd).toBe('~/work/api');
  });
  it('redacts .env diffs entirely', () => {
    const t = { ...tl, events: [{ kind: 'edit' as const, at: 0, path: '.env', created: true, added: 1, removed: 0, diff: [{ op: '+' as const, text: 'SECRET_THING=plain' }] }] };
    const r = redactTimeline(t);
    expect(r.events[0].kind === 'edit' && r.events[0].diff[0].text).toBe(`SECRET_THING=${MASK}`);
  });
  it('trims long outputs', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i}`);
    const c = clipLines(lines, 10, 80);
    expect(c).toHaveLength(10);
    expect(c.some((l) => l.includes('more lines'))).toBe(true);
    expect(clipLines(['x'.repeat(500)], 5, 40)[0].length).toBe(40);
    const t = trimTimeline({ ...tl, events: [{ kind: 'command', at: 0, command: 'x', output: lines, exitOk: true, isTest: false }] });
    expect(t.events[0].kind === 'command' && t.events[0].output.length).toBeLessThanOrEqual(14);
  });
});

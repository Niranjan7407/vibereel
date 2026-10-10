// Builds fixtures/demo-dark-mode.jsonl: a fully synthetic Claude Code session used for the README demo.
// Nothing here comes from a real transcript. Run: node fixtures/make-demo.mjs
import fs from 'node:fs';

const cwd = '/Users/alex/code/todo-app';
const sessionId = '7f3c2a10-5b1e-4d2a-9c11-0d1e2f3a4b5c';
const t0 = Date.parse('2026-10-08T09:12:04Z');
let n = 0, msg = 0, cacheRead = 18000;
const lines = [];
const ts = (min) => new Date(t0 + min * 60000).toISOString();
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const common = (min) => ({ isSidechain: false, userType: 'external', cwd, sessionId, version: '2.1.0', gitBranch: 'main', uuid: uuid(), timestamp: ts(min) });

function user(min, content, extra = {}) {
  lines.push({ ...common(min), type: 'user', message: { role: 'user', content }, ...extra });
}
function assistant(min, blocks, { write = 5200, out = 1400 } = {}) {
  cacheRead += write;
  lines.push({
    ...common(min), type: 'assistant',
    message: {
      model: 'claude-opus-4-6', id: `msg_demo_${++msg}`, type: 'message', role: 'assistant', content: blocks,
      stop_reason: blocks.some((b) => b.type === 'tool_use') ? 'tool_use' : 'end_turn',
      usage: { input_tokens: 6, cache_creation_input_tokens: write, cache_read_input_tokens: cacheRead, output_tokens: out },
    },
  });
}
let tid = 0;
function tool(min, name, input, result, { isError = false, toolUseResult, write, out } = {}) {
  const id = `toolu_demo_${++tid}`;
  assistant(min, [{ type: 'tool_use', id, name, input }], { write, out });
  user(min + 0.4, [{ tool_use_id: id, type: 'tool_result', content: result, is_error: isError }], { toolUseResult: toolUseResult ?? (typeof result === 'string' ? { stdout: result, stderr: '' } : result) });
}

const P = (p) => `${cwd}/${p}`;

user(0, 'Add a dark mode to the todo app. It should follow the system setting by default, have a toggle in the header, and remember the choice. Keep the tests green.');

assistant(0.3, [{ type: 'text', text: "I'll look at how styles are wired up first, then add theme tokens, a small hook, and a header toggle." }], { write: 9800, out: 320 });

tool(0.5, 'TodoWrite', { todos: [
  { content: 'Map where colors are hard-coded', status: 'in_progress' },
  { content: 'Move colors into CSS variables with a dark set', status: 'pending' },
  { content: 'Add a useTheme hook that persists to localStorage', status: 'pending' },
  { content: 'Put a toggle in the header', status: 'pending' },
  { content: 'Cover the hook with tests', status: 'pending' },
] }, 'Todos have been modified successfully.', { write: 2100, out: 610 });

tool(1.2, 'Read', { file_path: P('src/App.tsx') },
  `     1\timport { Header } from './components/Header';\n     2\timport { TodoList } from './components/TodoList';\n     3\timport { useTodos } from './hooks/useTodos';\n     4\timport './styles.css';\n     5\t\n     6\texport default function App() {\n     7\t  const todos = useTodos();\n     8\t  return (\n     9\t    <main className="app">\n    10\t      <Header count={todos.remaining} />\n    11\t      <TodoList {...todos} />\n    12\t    </main>\n    13\t  );\n    14\t}\n`);

tool(2.0, 'Grep', { pattern: '#[0-9a-f]{3,6}', path: P('src') },
  'src/styles.css:3:  background: #ffffff;\nsrc/styles.css:4:  color: #1d1d1f;\nsrc/styles.css:12:  border: 1px solid #e5e5e5;\nsrc/components/Header.tsx:9:  <h1 style={{ color: "#1d1d1f" }}>');

tool(2.6, 'Read', { file_path: P('src/styles.css') },
  `     1\t.app {\n     2\t  max-width: 640px;\n     3\t  background: #ffffff;\n     4\t  color: #1d1d1f;\n     5\t  margin: 48px auto;\n     6\t  font: 15px/1.5 system-ui, sans-serif;\n     7\t}\n     8\t\n     9\t.todo {\n    10\t  display: flex;\n    11\t  padding: 10px 12px;\n    12\t  border: 1px solid #e5e5e5;\n    13\t}\n`);

tool(6.5, 'Edit', {
  file_path: P('src/styles.css'),
  old_string: `.app {\n  max-width: 640px;\n  background: #ffffff;\n  color: #1d1d1f;\n  margin: 48px auto;`,
  new_string: `:root {\n  --bg: #ffffff;\n  --text: #1d1d1f;\n  --border: #e5e5e5;\n  --muted: #6e6e73;\n}\n\n:root[data-theme="dark"] {\n  --bg: #111113;\n  --text: #ececf1;\n  --border: #2a2a2e;\n  --muted: #8e8e93;\n}\n\n.app {\n  max-width: 640px;\n  background: var(--bg);\n  color: var(--text);\n  margin: 48px auto;\n  transition: background 0.2s, color 0.2s;`,
}, 'The file src/styles.css has been updated successfully.', { write: 7400, out: 2300 });

tool(7.4, 'Edit', {
  file_path: P('src/styles.css'),
  old_string: `  border: 1px solid #e5e5e5;`,
  new_string: `  border: 1px solid var(--border);`,
}, 'The file src/styles.css has been updated successfully.', { write: 1800, out: 300 });

tool(12.1, 'Write', {
  file_path: P('src/hooks/useTheme.ts'),
  content: `import { useEffect, useState } from 'react';\n\nexport type Theme = 'light' | 'dark';\nconst KEY = 'todo.theme';\n\nfunction initialTheme(): Theme {\n  const saved = localStorage.getItem(KEY);\n  if (saved === 'light' || saved === 'dark') return saved;\n  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';\n}\n\nexport function useTheme() {\n  const [theme, setTheme] = useState<Theme>(initialTheme);\n\n  useEffect(() => {\n    document.documentElement.dataset.theme = theme;\n    localStorage.setItem(KEY, theme);\n  }, [theme]);\n\n  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));\n  return { theme, toggle };\n}\n`,
}, 'File created successfully at: src/hooks/useTheme.ts', { write: 6900, out: 2600, toolUseResult: { type: 'create' } });

tool(15.8, 'Edit', {
  file_path: P('src/components/Header.tsx'),
  old_string: `export function Header({ count }: { count: number }) {\n  return (\n    <header className="header">\n      <h1 style={{ color: "#1d1d1f" }}>Todos</h1>\n      <span className="count">{count} left</span>\n    </header>\n  );\n}`,
  new_string: `import { useTheme } from '../hooks/useTheme';\n\nexport function Header({ count }: { count: number }) {\n  const { theme, toggle } = useTheme();\n  return (\n    <header className="header">\n      <h1>Todos</h1>\n      <span className="count">{count} left</span>\n      <button className="theme-toggle" onClick={toggle} aria-label="Toggle dark mode">\n        {theme === 'dark' ? 'Light' : 'Dark'}\n      </button>\n    </header>\n  );\n}`,
}, 'The file src/components/Header.tsx has been updated successfully.', { write: 5600, out: 1900 });

tool(21.0, 'Write', {
  file_path: P('src/hooks/useTheme.test.ts'),
  content: `import { act, renderHook } from '@testing-library/react';\nimport { beforeEach, describe, expect, it } from 'vitest';\nimport { useTheme } from './useTheme';\n\ndescribe('useTheme', () => {\n  beforeEach(() => localStorage.clear());\n\n  it('falls back to the system preference', () => {\n    const { result } = renderHook(() => useTheme());\n    expect(result.current.theme).toBe('light');\n  });\n\n  it('toggles and remembers the choice', () => {\n    const { result } = renderHook(() => useTheme());\n    act(() => result.current.toggle());\n    expect(result.current.theme).toBe('dark');\n    expect(localStorage.getItem('todo.theme')).toBe('dark');\n  });\n});\n`,
}, 'File created successfully at: src/hooks/useTheme.test.ts', { write: 5200, out: 2100, toolUseResult: { type: 'create' } });

const failOut = ` RUN  v3.2.4 ${cwd}\n\n ✓ src/hooks/useTodos.test.ts (9 tests) 41ms\n ✓ src/components/TodoList.test.tsx (7 tests) 88ms\n ❯ src/hooks/useTheme.test.ts (2 tests | 2 failed) 12ms\n   × useTheme > falls back to the system preference\n     → window.matchMedia is not a function\n   × useTheme > toggles and remembers the choice\n     → window.matchMedia is not a function\n\n Test Files  1 failed | 2 passed (3)\n      Tests  2 failed | 16 passed (18)\n   Duration  1.42s`;
tool(23.2, 'Bash', { command: 'npm test', description: 'Run the test suite' }, failOut, { isError: true, toolUseResult: { stdout: failOut, stderr: '' }, write: 4100, out: 380 });

assistant(24.0, [{ type: 'text', text: "jsdom doesn't ship matchMedia, so the hook throws before it can read the saved theme. I'll stub it once in the test setup instead of guarding it in app code." }], { write: 3900, out: 520 });

tool(26.5, 'Edit', {
  file_path: P('src/test/setup.ts'),
  old_string: `import '@testing-library/jest-dom/vitest';\n`,
  new_string: `import '@testing-library/jest-dom/vitest';\nimport { vi } from 'vitest';\n\n// jsdom has no matchMedia; default to a light system theme\nObject.defineProperty(window, 'matchMedia', {\n  writable: true,\n  value: vi.fn((query: string) => ({\n    matches: false,\n    media: query,\n    addEventListener: vi.fn(),\n    removeEventListener: vi.fn(),\n  })),\n});\n`,
}, 'The file src/test/setup.ts has been updated successfully.', { write: 4800, out: 1500 });

const passOut = ` RUN  v3.2.4 ${cwd}\n\n ✓ src/hooks/useTodos.test.ts (9 tests) 39ms\n ✓ src/components/TodoList.test.tsx (7 tests) 85ms\n ✓ src/hooks/useTheme.test.ts (2 tests) 9ms\n\n Test Files  3 passed (3)\n      Tests  18 passed (18)\n   Duration  1.37s`;
tool(27.9, 'Bash', { command: 'npm test', description: 'Run the test suite' }, passOut, { write: 3600, out: 300 });

const buildOut = `> todo-app@0.4.0 build\n> tsc && vite build\n\nvite v6.2.0 building for production...\n✓ 42 modules transformed.\ndist/index.html                  0.46 kB\ndist/assets/index-Bq3x9f.css     2.18 kB\ndist/assets/index-D81kLm.js    146.72 kB\n✓ built in 1.84s`;
tool(31.4, 'Bash', { command: 'npm run build', description: 'Type-check and build' }, buildOut, { write: 3300, out: 260 });

tool(38.7, 'Bash', { command: 'git add -A && git commit -m "Add dark mode with system default and header toggle"', description: 'Commit' },
  '[main 4e1a9c2] Add dark mode with system default and header toggle\n 5 files changed, 78 insertions(+), 6 deletions(-)\n create mode 100644 src/hooks/useTheme.ts\n create mode 100644 src/hooks/useTheme.test.ts', { write: 2900, out: 400 });

assistant(47.2, [{ type: 'text', text: 'Dark mode is in. It follows the system setting until you use the new toggle in the header, then remembers the choice. Colors now live in CSS variables, and all 18 tests pass.' }], { write: 3100, out: 900 });

fs.writeFileSync(new URL('./demo-dark-mode.jsonl', import.meta.url), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
console.log(`wrote ${lines.length} lines`);

# Contributing to vibereel

Thanks for helping out! Small PRs are very welcome.

## Getting started

You need Node 20 or newer.

```sh
git clone https://github.com/TanbirRamim/vibereel
cd vibereel
npm install
npm run build
npm test
```

Try it on the bundled fixture:

```sh
node dist/cli.js --file fixtures/demo-dark-mode.jsonl --out /tmp/demo.html --open
```

Add `--json` to also write the normalised timeline, which is handy when you are working on a parser.

### Rendering the demo

`npm run demo` rebuilds and renders `assets/demo.html` plus the GIF and MP4. Video export needs `ffmpeg` on your PATH, a local Chrome or Chromium, and the optional `puppeteer-core` dependency. The HTML player works without any of that.

## Picking an issue

1. Look for `good first issue` or `help wanted`.
2. Leave a comment saying you'd like to take it, so nobody doubles up.
3. If you go quiet for a week or so, the issue may be handed to someone else. No hard feelings.

Got an idea that isn't an issue yet? Open one first so we can chat about the approach.

## Pull request checklist

- [ ] `npm run build` and `npm test` pass locally
- [ ] New behaviour has a test (parsers: add a small fixture under `fixtures/` or inline in the test)
- [ ] Visual changes include a screenshot or short clip in the PR
- [ ] The PR links the issue it closes (`Closes #12`)
- [ ] No real session data in the diff (see below)

## Never commit real session transcripts

Claude Code, Codex and other agent logs often contain file contents, env vars, API keys, internal paths and private chat. Please do not add real `.jsonl` sessions to the repo, to issues or to PRs, even "just for a test".

Instead, write a tiny hand-made fixture with only the fields the parser needs, or share a redacted `--json` timeline (vibereel redacts by default) and double check it before posting.

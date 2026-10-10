import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function which(bin: string): string | null {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.split('\n')[0].trim() || null : null;
}

export function findChrome(): string | null {
  const env = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;
  const mac = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ];
  const win = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of process.platform === 'darwin' ? mac : process.platform === 'win32' ? win : []) if (fs.existsSync(p)) return p;
  for (const b of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    const p = which(b); if (p) return p;
  }
  return null;
}

export interface ExportOptions {
  html: string;
  aspect: '16:9' | '9:16';
  duration: number;
  mp4?: string;
  gif?: string;
  fps?: number;
  gifFps?: number;
  gifWidth?: number;
  scale?: number;
  log?: (s: string) => void;
}

export class ExportError extends Error {}

export async function exportVideo(o: ExportOptions): Promise<void> {
  const log = o.log ?? (() => {});
  const ffmpeg = which('ffmpeg');
  if (!ffmpeg) throw new ExportError('ffmpeg not found. Install it (brew install ffmpeg / apt install ffmpeg) to export MP4/GIF. The HTML player works without it.');
  const chrome = findChrome();
  if (!chrome) throw new ExportError('Chrome/Chromium not found. Set CHROME_PATH to a Chrome binary to export MP4/GIF. The HTML player works without it.');
  let puppeteer: any;
  try { puppeteer = (await import('puppeteer-core' as string)).default; }
  catch { throw new ExportError('puppeteer-core is not installed (it is an optional dependency). Run: npm i -g puppeteer-core, or reinstall vibereel with optional deps.'); }

  const fps = o.mp4 ? (o.fps ?? 30) : (o.gifFps ?? 15);
  const [w, h] = o.aspect === '9:16' ? [720, 1280] : [1280, 720];
  const scale = o.scale ?? 1.5;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibereel-'));
  const htmlPath = path.join(dir, 'reel.html');
  fs.writeFileSync(htmlPath, o.html);
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb', '--font-render-hinting=none'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: scale });
    await page.goto(pathToFileURL(htmlPath).href + '?capture=1', { waitUntil: 'load' });
    await page.waitForFunction('window.__reel && window.__reel.ready');
    const total = Math.ceil(o.duration * fps) + 1;
    for (let i = 0; i < total; i++) {
      await page.evaluate((t: number) => (window as any).__reel.seek(t), i / fps);
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, '0')}.png`), type: 'png' });
      if (i % fps === 0) log(`  captured ${i}/${total} frames`);
    }
  } finally { await browser.close(); }

  const input = ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, 'f%05d.png')];
  if (o.mp4) {
    execFileSync(ffmpeg, [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', o.mp4], { stdio: 'inherit' });
    log(`  wrote ${o.mp4}`);
  }
  if (o.gif) {
    const gw = o.gifWidth ?? (o.aspect === '9:16' ? 480 : 960);
    const vf = `fps=${o.gifFps ?? 15},scale=${gw}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
    execFileSync(ffmpeg, [...input, '-vf', vf, '-loop', '0', o.gif], { stdio: 'inherit' });
    log(`  wrote ${o.gif}`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

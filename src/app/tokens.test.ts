// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const GLOBALS_CSS = fileURLToPath(new URL('./globals.css', import.meta.url));
const SRC_DIR = fileURLToPath(new URL('..', import.meta.url));

/** The `--name: #rrggbb` declarations of one top-level block of globals.css. */
function readTokens(selector: ':root' | '.dark'): Map<string, string> {
  const css = readFileSync(GLOBALS_CSS, 'utf8');
  const escaped = selector.replace('.', '\\.');
  const block = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  if (!block) throw new Error(`No ${selector} block in globals.css`);
  const tokens = new Map<string, string>();
  for (const match of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    tokens.set(match[1] ?? '', (match[2] ?? '').toLowerCase());
  }
  return tokens;
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two opaque colours. */
function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

const TEXT = 4.5; // WCAG 1.4.3, normal text
const NON_TEXT = 3; // WCAG 1.4.11: focus rings, field borders, chart bars, the sidebar's active marker

// [foreground token, background token, minimum ratio]: the pairs in design.md's token table.
const PAIRS: readonly (readonly [string, string, number])[] = [
  ['foreground', 'background', TEXT],
  ['foreground', 'card', TEXT],
  ['foreground', 'muted', TEXT],
  ['card-foreground', 'card', TEXT],
  ['popover-foreground', 'popover', TEXT],
  ['muted-foreground', 'background', TEXT],
  ['muted-foreground', 'card', TEXT],
  ['muted-foreground', 'muted', TEXT],
  ['background', 'foreground', TEXT], // tooltips
  ['input', 'card', NON_TEXT],
  ['input', 'background', NON_TEXT],
  ['ring', 'card', NON_TEXT],
  ['ring', 'background', NON_TEXT],
  ['primary', 'background', TEXT],
  ['primary', 'card', TEXT],
  ['primary-foreground', 'primary', TEXT],
  ['primary', 'primary-soft', TEXT],
  ['accent-foreground', 'accent', TEXT],
  ['accent', 'card', NON_TEXT], // icons
  ['accent-strong', 'background', TEXT],
  ['accent-strong', 'card', TEXT],
  ['accent-strong', 'accent-soft', TEXT],
  ['secondary-foreground', 'secondary', TEXT],
  ['success', 'success-soft', TEXT],
  ['success', 'card', TEXT],
  ['warning', 'warning-soft', TEXT],
  ['warning', 'card', TEXT],
  ['destructive', 'destructive-soft', TEXT],
  ['destructive', 'card', TEXT],
  ['destructive-foreground', 'destructive', TEXT],
  ['info', 'info-soft', TEXT],
  ['info', 'card', TEXT],
  ['foreground', 'success-soft', TEXT], // alerts and toasts
  ['foreground', 'warning-soft', TEXT],
  ['foreground', 'destructive-soft', TEXT],
  ['foreground', 'info-soft', TEXT],
  ['chart-1', 'card', NON_TEXT],
  ['chart-2', 'card', NON_TEXT],
  ['chart-3', 'card', NON_TEXT],
  ['chart-4', 'card', NON_TEXT],
  ['sidebar-foreground', 'sidebar', TEXT],
  ['sidebar-muted', 'sidebar', TEXT],
  ['sidebar-active-foreground', 'sidebar-active', TEXT],
  ['sidebar-ring', 'sidebar', NON_TEXT],
  ['sidebar-ring', 'sidebar-active', NON_TEXT],
  ['accent-foreground', 'accent', TEXT], // the sidebar's brand mark
];

const THEMES = [
  ['light', readTokens(':root')],
  ['dark', readTokens('.dark')],
] as const;

describe('theme tokens', () => {
  it('defines every colour token in both themes', () => {
    const [[, light], [, dark]] = THEMES;
    expect([...dark.keys()].sort()).toEqual([...light.keys()].sort());
    expect(light.size).toBeGreaterThan(40);
  });

  // Feature: frontend-shell, Property 14: Token pairs meet their contrast minimums
  describe.each(THEMES)('%s theme', (_name, tokens) => {
    it.each(PAIRS)('%s on %s meets %s:1', (foreground, background, minimum) => {
      const fg = tokens.get(foreground);
      const bg = tokens.get(background);
      expect(fg, `--${foreground}`).toBeDefined();
      expect(bg, `--${background}`).toBeDefined();
      expect(contrastRatio(fg ?? '', bg ?? '')).toBeGreaterThanOrEqual(minimum);
    });
  });
});

/** Source files that may not contain colour literals: everything but tests and globals.css. */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.(tsx?|css)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return full === GLOBALS_CSS ? [] : [full];
  });
}

const HEX_COLOUR = /(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/;
const FUNCTION_COLOUR = /\b(?:rgba?|hsla?|hwb|oklch|oklab)\(/;

describe('colour literals', () => {
  it('appear only in globals.css, so components always use the theme tokens', () => {
    const offenders = sourceFiles(SRC_DIR).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => HEX_COLOUR.test(line) || FUNCTION_COLOUR.test(line))
        .map(({ line, index }) => `${path.relative(SRC_DIR, file)}:${index + 1}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

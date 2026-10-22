/** True on macOS and iOS, where shortcuts use ⌘ rather than Ctrl. Browser only. */
export function isApplePlatform(): boolean {
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

/** True for the command palette shortcut: ⌘K on Apple platforms, Ctrl+K elsewhere. */
export function isPaletteShortcut(event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() !== 'k' || event.altKey || event.shiftKey) return false;
  return isApplePlatform() ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}

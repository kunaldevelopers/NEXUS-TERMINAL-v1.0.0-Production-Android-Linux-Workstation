export const DEFAULT_TOOLBAR_KEYS = [
  { id: 'esc', label: 'ESC', type: 'seq', value: '\x1b' },
  { id: 'ctrl', label: 'CTRL', type: 'modifier', mod: 'ctrl' },
  { id: 'alt', label: 'ALT', type: 'modifier', mod: 'alt' },
  { id: 'tab', label: 'TAB', type: 'seq', value: '\t' },
  { id: 'home', label: 'HOME', type: 'seq', value: '\x1b[H' },
  { id: 'end', label: 'END', type: 'seq', value: '\x1b[F' },
  { id: 'pgup', label: 'PGUP', type: 'seq', value: '\x1b[5~' },
  { id: 'pgdn', label: 'PGDN', type: 'seq', value: '\x1b[6~' },
  { id: 'up', label: 'UP', type: 'seq', value: '\x1b[A' },
  { id: 'down', label: 'DOWN', type: 'seq', value: '\x1b[B' },
  { id: 'left', label: 'LEFT', type: 'seq', value: '\x1b[D' },
  { id: 'right', label: 'RIGHT', type: 'seq', value: '\x1b[C' },
  { id: 'ctrl-c', label: 'CTRL+C', type: 'seq', value: '\x03' },
  { id: 'ctrl-d', label: 'CTRL+D', type: 'seq', value: '\x04' },
  { id: 'ctrl-z', label: 'CTRL+Z', type: 'seq', value: '\x1a' },
  { id: 'ctrl-a', label: 'CTRL+A', type: 'seq', value: '\x01' },
  { id: 'ctrl-e', label: 'CTRL+E', type: 'seq', value: '\x05' },
  { id: 'ctrl-l', label: 'CTRL+L', type: 'seq', value: '\x0c' },
  { id: 'ctrl-r', label: 'CTRL+R', type: 'seq', value: '\x12' },
  { id: 'slash', label: '/', type: 'seq', value: '/' },
  { id: 'pipe', label: '|', type: 'seq', value: '|' },
  { id: 'dash', label: '-', type: 'seq', value: '-' },
  { id: 'tilde', label: '~', type: 'seq', value: '~' },
];

export const ALL_CUSTOMIZABLE_KEYS = [
  ...DEFAULT_TOOLBAR_KEYS,
  { id: 'underscore', label: '_', type: 'seq', value: '_' },
  { id: 'ampersand', label: '&', type: 'seq', value: '&' },
  { id: 'gt', label: '>', type: 'seq', value: '>' },
  { id: 'lt', label: '<', type: 'seq', value: '<' },
  { id: 'dollar', label: '$', type: 'seq', value: '$' },
  { id: 'backslash', label: '\\', type: 'seq', value: '\\' },
  { id: 'ctrl-w', label: 'CTRL+W', type: 'seq', value: '\x17' },
  { id: 'ctrl-u', label: 'CTRL+U', type: 'seq', value: '\x15' },
  { id: 'f1', label: 'F1', type: 'seq', value: '\x1bOP' },
  { id: 'f2', label: 'F2', type: 'seq', value: '\x1bOQ' },
  { id: 'f10', label: 'F10', type: 'seq', value: '\x1b[21~' },
];

export function applyControlModifier(data, ctrlActive, altActive) {
  let out = data;
  if (ctrlActive && out.length === 1) {
    const code = out.toUpperCase().charCodeAt(0);
    if (code >= 64 && code <= 95) {
      out = String.fromCharCode(code - 64);
    } else if (out === ' ') {
      out = '\x00';
    }
  }
  if (altActive) {
    out = '\x1b' + out;
  }
  return out;
}


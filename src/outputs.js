// Parses the action's `outputs` input. One target per line:
//   dist/life-dark.svg?theme=life&mode=dark&palette=ocean&speed=1.5
// Blank lines and lines starting with # are ignored.

const KEYS = new Set(['theme', 'palette', 'mode', 'speed', 'background', 'label']);

export function parseOutputs(text) {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const q = line.indexOf('?');
      const file = (q === -1 ? line : line.slice(0, q)).trim();
      const options = {};
      if (q !== -1) {
        for (const [key, value] of new URLSearchParams(line.slice(q + 1))) {
          if (!KEYS.has(key)) throw new Error(`Unknown option "${key}" in output "${line}"`);
          options[key] = value;
        }
      }
      if (!file) throw new Error(`Missing file path in output "${line}"`);
      return { file, options };
    });
}

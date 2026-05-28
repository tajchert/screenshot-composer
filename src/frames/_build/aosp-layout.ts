export interface AospGeometry {
  display: { width: number; height: number };
  cornerRadius: number | null;
  frame: { width: number; height: number };
  offset: { x: number; y: number };
}

/** Parse an AOSP emulator skin `layout` file (measurements only). */
export function parseAospLayout(text: string): AospGeometry {
  const display = sliceBlock(text, 'display');
  const layouts = sliceBlock(text, 'layouts');
  const deviceAt = layouts.indexOf('name device');
  const devicePart = deviceAt >= 0 ? layouts.slice(deviceAt) : layouts;

  const radius = num(display, 'corner_radius');
  return {
    display: { width: req(display, 'width'), height: req(display, 'height') },
    cornerRadius: radius === undefined ? null : radius,
    frame: { width: req(layouts, 'width'), height: req(layouts, 'height') },
    offset: { x: req(devicePart, 'x'), y: req(devicePart, 'y') },
  };
}

function sliceBlock(text: string, key: string): string {
  const i = text.indexOf(`${key} {`);
  return i >= 0 ? text.slice(i) : text;
}
function num(block: string, key: string): number | undefined {
  const m = new RegExp(`\\b${key}\\s+(-?\\d+)`).exec(block);
  return m ? Number(m[1]) : undefined;
}
function req(block: string, key: string): number {
  const v = num(block, key);
  if (v === undefined) throw new Error(`layout missing '${key}'`);
  return v;
}

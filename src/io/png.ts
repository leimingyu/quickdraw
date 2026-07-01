// Tag a canvas-produced PNG with a physical resolution (pHYs chunk) so image
// editors and print pipelines report the intended DPI. canvas.toBlob() omits
// pHYs, which most tools then treat as 72 DPI regardless of pixel count.

/** CRC-32 (PNG/zlib polynomial 0xEDB88320) over `bytes`. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** A PNG `pHYs` chunk declaring `dpi` dots per inch on both axes (unit = metre). */
export function physChunk(dpi: number): Uint8Array {
  // Round the integer pixels-per-metre UP so the encoded DPI is never below `dpi`
  // (rounding to nearest can land a hair under, e.g. 300 → 11811 ppm ≈ 299.9994).
  const ppm = Math.ceil(dpi / 0.0254); // pixels per metre, ≥ dpi
  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 CRC
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9); // data length
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm); // x pixels/metre
  dv.setUint32(12, ppm); // y pixels/metre
  chunk[16] = 1; // unit specifier: metre
  dv.setUint32(17, crc32(chunk.subarray(4, 17))); // CRC over type + data
  return chunk;
}

/** Insert a pHYs chunk right after IHDR so the PNG reports `dpi`. Returns new
 *  bytes; the input is unchanged. Falls back to the input if it isn't a PNG. */
export function insertPhys(png: Uint8Array, dpi: number): Uint8Array {
  const IHDR_END = 8 + 25; // 8-byte signature + IHDR chunk (4 len + 4 type + 13 data + 4 CRC)
  const isPng = png.length >= IHDR_END &&
    png[12] === 0x49 && png[13] === 0x48 && png[14] === 0x44 && png[15] === 0x52; // "IHDR"
  if (!isPng) return png;
  const phys = physChunk(dpi);
  const out = new Uint8Array(png.length + phys.length);
  out.set(png.subarray(0, IHDR_END), 0);
  out.set(phys, IHDR_END);
  out.set(png.subarray(IHDR_END), IHDR_END + phys.length);
  return out;
}

/** Re-wrap a PNG blob with a pHYs chunk declaring `dpi`. */
export async function pngWithDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Copy into a fresh ArrayBuffer-backed view so the Blob part is definitely
  // ArrayBuffer (not SharedArrayBuffer), which the Blob type requires.
  return new Blob([new Uint8Array(insertPhys(bytes, dpi))], { type: 'image/png' });
}

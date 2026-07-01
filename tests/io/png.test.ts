import { describe, it, expect } from 'vitest';
import { crc32, physChunk, insertPhys } from '../../src/io/png';

/** A minimal byte stream shaped like a PNG: 8-byte signature + IHDR(25) + IDAT-ish. */
function fakePng(): Uint8Array {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const ihdr = [
    0, 0, 0, 13, 73, 72, 68, 82, // length 13, "IHDR"
    0, 0, 0, 10, 0, 0, 0, 10, 8, 6, 0, 0, 0, // 13 data bytes
    1, 2, 3, 4, // CRC (bogus, fine for this test)
  ];
  const idat = [0, 0, 0, 0, 73, 68, 65, 84, 5, 6, 7, 8]; // "IDAT" + bytes
  return new Uint8Array([...sig, ...ihdr, ...idat]);
}

describe('PNG DPI tagging', () => {
  it('crc32 matches the well-known IEND checksum', () => {
    expect(crc32(new Uint8Array([0x49, 0x45, 0x4e, 0x44]))).toBe(0xae426082);
  });

  it('physChunk encodes ≥300 DPI (11812 px/m, rounded up) with a self-consistent CRC', () => {
    const c = physChunk(300);
    const dv = new DataView(c.buffer);
    expect(dv.getUint32(0)).toBe(9); // data length
    expect(String.fromCharCode(c[4], c[5], c[6], c[7])).toBe('pHYs');
    expect(dv.getUint32(8)).toBe(11812); // x px/m → 300.025 DPI (never below 300)
    expect(dv.getUint32(12)).toBe(11812); // y px/m
    expect(dv.getUint32(8) * 0.0254).toBeGreaterThanOrEqual(300); // no less than 300 DPI
    expect(c[16]).toBe(1); // unit = metre
    expect(dv.getUint32(17)).toBe(crc32(c.subarray(4, 17)));
  });

  it('insertPhys splices a pHYs chunk in right after IHDR', () => {
    const src = fakePng();
    const out = insertPhys(src, 300);
    expect(out.length).toBe(src.length + 21);
    const dv = new DataView(out.buffer);
    expect(dv.getUint32(33)).toBe(9); // chunk begins at offset 33
    expect(String.fromCharCode(out[37], out[38], out[39], out[40])).toBe('pHYs');
    expect(dv.getUint32(41)).toBe(11812);
    // the original IDAT bytes still follow the inserted chunk
    expect(String.fromCharCode(out[58], out[59], out[60], out[61])).toBe('IDAT');
  });

  it('leaves non-PNG bytes untouched', () => {
    const junk = new Uint8Array([1, 2, 3, 4, 5]);
    expect(insertPhys(junk, 300)).toBe(junk);
  });
});

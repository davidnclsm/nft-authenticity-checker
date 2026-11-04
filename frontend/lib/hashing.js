// Hash-Funktionen, die komplett im Browser laufen.

/**
 * Kryptografischer Hash: SHA-256 über die rohen Bytes der Datei.
 * Gleiche Datei => gleicher Hash. Ein einziges geändertes Bit => völlig anderer Hash.
 * @returns {Promise<string>} 0x-präfixierter Hex-String (32 Byte = bytes32 im Contract)
 */
export async function sha256File(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Perceptual Hash (dHash, "difference hash"): beschreibt, wie das Bild AUSSIEHT.
 * 1. Bild auf 9x8 Pixel verkleinern, 2. in Graustufen umwandeln,
 * 3. pro Zeile vergleichen: ist ein Pixel heller als sein rechter Nachbar? => 1 Bit.
 * Ergebnis: 64 Bit. Ähnliche Bilder => ähnliche Bits.
 * @returns {Promise<string>} 16 Hex-Zeichen (64 Bit)
 */
export async function dHashFile(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 9;
  canvas.height = 8;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, 9, 8);
  bitmap.close?.();

  const { data } = ctx.getImageData(0, 0, 9, 8);
  const gray = (x, y) => {
    const i = (y * 9 + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (gray(x, y) > gray(x + 1, y) ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, "0");
}

/** Hamming-Distanz zweier dHashes: Anzahl unterschiedlicher Bits (0 = gleich, 64 = komplett anders). */
export function hammingDistance(hexA, hexB) {
  let x = BigInt("0x" + hexA) ^ BigInt("0x" + hexB);
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

/** Anzahl unterschiedlicher Hex-Zeichen zweier SHA-256-Hashes (zeigt den Lawineneffekt). */
export function differingChars(hashA, hashB) {
  const a = hashA.replace(/^0x/, "");
  const b = hashB.replace(/^0x/, "");
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff;
}

/** Ab dieser Hamming-Distanz (von 64 Bit) gilt ein Bild als "visuell ähnlich". */
export const SIMILARITY_THRESHOLD = 10;

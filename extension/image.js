export const MAX_BYTES = 20 * 1024 * 1024;

export function sourcePermission(source) {
  const url = new URL(source);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Only public HTTPS images are supported. Blob, local, HTTP, and sign-in-only images cannot be shared by this version.");
  }
  return `${url.origin}/*`;
}

export function imageType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return ["image/jpeg", "jpg"];
  const ascii = (start, end) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [137,80,78,71,13,10,26,10][i])) return ["image/png", "png"];
  if (["GIF87a", "GIF89a"].includes(ascii(0, 6))) return ["image/gif", "gif"];
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return ["image/webp", "webp"];
  throw new Error("This image format is not supported. Use JPEG, PNG, GIF, or WebP.");
}

export async function readImage(response) {
  if (!response.ok) throw new Error(`The image server returned HTTP ${response.status}.`);
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("Images must be 20 MB or smaller.");
  if (!response.body) throw new Error("The image response is empty.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("Images must be 20 MB or smaller.");
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const [mime, extension] = imageType(bytes);
  return new File([bytes], `image.${extension}`, { type: mime });
}

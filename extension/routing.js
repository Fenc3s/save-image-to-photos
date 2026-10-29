export function isCrossOriginImage(source, pageURL) {
  try {
    return new URL(source).protocol === "https:" && new URL(source).origin !== new URL(pageURL).origin;
  } catch {
    return false;
  }
}

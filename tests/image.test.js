import test from "node:test";
import assert from "node:assert/strict";
import { MAX_BYTES, sourcePermission, imageType, readImage } from "../extension/image.js";

const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0]);

test("permission is scoped to the selected HTTPS origin", () => {
  assert.equal(sourcePermission("https://images.example.com/photo.jpg?token=secret"), "https://images.example.com/*");
  for (const url of ["http://a.test/x", "blob:https://a.test/id", "file:///tmp/x", "data:image/png;base64,x", "https://user:pass@a.test/x", "invalid"]) {
    assert.throws(() => sourcePermission(url));
  }
});

test("image signatures determine the type instead of server headers", () => {
  assert.deepEqual(imageType(png), ["image/png", "png"]);
  assert.deepEqual(imageType(new Uint8Array([255,216,255])), ["image/jpeg", "jpg"]);
  assert.deepEqual(imageType(new TextEncoder().encode("GIF89a123")), ["image/gif", "gif"]);
  assert.deepEqual(imageType(new TextEncoder().encode("RIFF1234WEBP")), ["image/webp", "webp"]);
  for (const bytes of [new Uint8Array(), new TextEncoder().encode("<svg></svg>"), new Uint8Array([137,80,78])]) assert.throws(() => imageType(bytes));
});

test("a selected image keeps its bytes and receives a safe filename", async () => {
  const file = await readImage(new Response(png, { headers: { "content-type": "text/html" } }));
  assert.equal(file.type, "image/png");
  assert.equal(file.name, "image.png");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), png);
});

test("HTTP failure, oversized advertised data, and HTML are rejected", async () => {
  await assert.rejects(readImage(new Response(null, { status: 403 })), /403/);
  await assert.rejects(readImage(new Response(png, { headers: { "content-length": String(MAX_BYTES + 1) } })), /20 MB/);
  await assert.rejects(readImage(new Response("<html>Not an image</html>")), /format/);
});

test("streaming size limit is enforced without Content-Length and cancels the stream", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_BYTES));
      controller.enqueue(new Uint8Array(1));
    },
    cancel() { cancelled = true; }
  });
  await assert.rejects(readImage(new Response(stream)), /20 MB/);
  assert.equal(cancelled, true);
});

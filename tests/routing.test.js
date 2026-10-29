import test from "node:test";
import assert from "node:assert/strict";
import { isCrossOriginImage } from "../extension/routing.js";

test("X image CDN uses a distinct-origin route while same-origin images stay in the page", () => {
  assert.equal(isCrossOriginImage("https://pbs.twimg.com/media/image.jpg", "https://x.com/home"), true);
  assert.equal(isCrossOriginImage("https://example.com/image.png", "https://example.com/page"), false);
  assert.equal(isCrossOriginImage("https://example.com/image.png", undefined), false);
  assert.equal(isCrossOriginImage("file:///tmp/image.png", "https://x.com/home"), false);
});

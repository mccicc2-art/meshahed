import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffBlob, sniffImage } from "./imageMagic.ts";

const bytes = (...n: number[]) => new Uint8Array(n);

test("known image signatures are recognised", () => {
  assert.equal(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.type, "image/jpeg");
  assert.equal(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.ext, "png");
  assert.equal(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))?.type, "image/webp");
});

test("anything else is refused", () => {
  assert.equal(sniffImage(bytes()), null);
  assert.equal(sniffImage(new TextEncoder().encode("<html><body>")), null);
  assert.equal(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)), null);
  assert.equal(sniffImage(bytes(0xff, 0xd8)), null);
});

test("sniffBlob reads only the head of a Blob", async () => {
  assert.equal((await sniffBlob(new Blob([bytes(0xff, 0xd8, 0xff, 0xdb, 0, 0)], { type: "image/png" })))?.type, "image/jpeg");
  assert.equal(await sniffBlob(new Blob(["GIF89a"], { type: "image/jpeg" })), null);
});

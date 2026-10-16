import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = vm.createContext({ URL });
for (const file of ["config.js", "tab-policy.js"]) {
  const code = await readFile(path.join(root, "extension", file), "utf8");
  vm.runInContext(code, context);
}
const policy = context.RojaTabPolicy;

test("closes external tabs and blank pop-unders from a streaming host", () => {
  const sourceUrl = "https://polocruz10.pages.dev/spo3";
  assert.equal(policy.shouldClose({ sourceUrl, targetUrl: "https://spam.example/ad" }), true);
  assert.equal(policy.shouldClose({ sourceUrl, targetUrl: "about:blank" }), true);
  assert.equal(policy.shouldClose({ sourceUrl, targetUrl: "" }), true);
});

test("keeps same-origin tabs and paused hosts", () => {
  const sourceUrl = "https://polocruz10.pages.dev/spo3";
  assert.equal(policy.shouldClose({
    sourceUrl,
    targetUrl: "https://polocruz10.pages.dev/help"
  }), false);
  assert.equal(policy.shouldClose({
    sourceUrl,
    targetUrl: "https://spam.example/ad",
    disabledHosts: ["polocruz10.pages.dev"]
  }), false);
});

test("keeps intended stream links opened from the RojaDirecta portal", () => {
  assert.equal(policy.shouldClose({
    sourceUrl: "http://www.rojadirecta.eu/",
    targetUrl: "https://polocruz10.pages.dev/spo3"
  }), false);
});

test("does not interfere with unrelated websites", () => {
  assert.equal(policy.shouldClose({
    sourceUrl: "https://example.com/",
    targetUrl: "https://another.example/"
  }), false);
});

test("protects hosts learned from the RojaDirecta navigation chain", () => {
  assert.equal(policy.shouldClose({
    sourceUrl: "https://new-player.example/watch",
    targetUrl: "https://spam.example/",
    learnedHosts: ["new-player.example"]
  }), true);
});

import { readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const manifest = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
const rules = JSON.parse(await readFile(path.join(extension, "rules/ads.json"), "utf8"));

if (manifest.manifest_version !== 3) throw new Error("manifest_version must be 3");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error("Invalid manifest version");
if (new Set(rules.map((rule) => rule.id)).size !== rules.length) throw new Error("DNR rule IDs must be unique");

const referencedFiles = [
  manifest.background.service_worker,
  manifest.action.default_popup,
  ...Object.values(manifest.icons),
  ...manifest.content_scripts.flatMap((entry) => entry.js),
  ...manifest.declarative_net_request.rule_resources.map((entry) => entry.path)
];

for (const file of new Set(referencedFiles)) {
  await access(path.join(extension, file), constants.R_OK);
}

const scripts = [
  "background.js",
  "config.js",
  "content.js",
  "main-world-guard.js",
  "popup.js"
];
for (const script of scripts) {
  const result = spawnSync(process.execPath, ["--check", path.join(extension, script)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `Syntax check failed: ${script}`);
}

console.log(`Manifest ${manifest.version}: ${rules.length} network rules, ${referencedFiles.length} referenced assets — OK`);


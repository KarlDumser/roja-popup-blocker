import { mkdir, rm, cp, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import process from "node:process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const dist = path.join(root, "dist");
const stage = path.join(dist, "roja-popup-blocker");
const manifest = JSON.parse(await readFile(path.join(extension, "manifest.json"), "utf8"));
const archive = path.join(dist, `roja-popup-blocker-v${manifest.version}.zip`);

const check = spawnSync(process.execPath, [path.join(root, "scripts/check.mjs")], { stdio: "inherit" });
if (check.status !== 0) process.exit(check.status ?? 1);

await mkdir(dist, { recursive: true });
await rm(stage, { recursive: true, force: true });
await rm(archive, { force: true });
await cp(extension, stage, { recursive: true });

const zip = spawnSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", stage, archive], {
  stdio: "inherit"
});
if (zip.status !== 0) throw new Error("Could not create ZIP archive with ditto");

await rm(stage, { recursive: true, force: true });
console.log(`Built ${path.relative(root, archive)}`);


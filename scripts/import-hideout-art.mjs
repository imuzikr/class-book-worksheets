// node scripts/import-hideout-art.mjs /path/to/hideout-refined-v2
// The approved WebP assets are checked in; this command only regenerates the catalog from the source delivery.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(process.argv[2] || "/workspace/hideout-refined-v2");
const target = path.join(repo, "public/reading-hideout");
const json = async (relative) => JSON.parse(await fs.readFile(path.join(source, relative), "utf8"));
const catalog = await json("catalog/manifest.json");
const images = await json("image-manifest.json");
const room = await json("room-manifest.json");
const shelves = await json("helpers/empty-wall-shelf/metadata.json");
if (catalog.items.length !== 120 || !catalog.refinedRugsApplied) throw Error("The approved refined 120-design catalog is required.");
const files = [];
async function copy(from, relative, expectedHash) {
  const bytes = await fs.readFile(path.join(source, from));
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  if (expectedHash && hash !== expectedHash) throw Error("Source hash mismatch: " + from);
  const dest = path.join(target, relative);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes);
  files.push({ path: relative, bytes: bytes.length, sha256: hash });
  return "/reading-hideout/" + relative;
}

const items = [];
for (const item of catalog.items) {
  const src = await copy("catalog/" + item.files.webp, item.files.webp, item.hashes.webp);
  items.push({ id: item.id, slot: item.category, name: item.name, theme: item.theme,
    themeName: item.themeName, stage: item.sampleUnlockStage, src, width: item.width, height: item.height });
}
const helperItems = [];
for (const entry of shelves.assets) {
  const src = await copy("helpers/empty-wall-shelf/" + entry.webp, "helpers/empty-wall-shelf/" + entry.webp, entry.sha256.webp);
  helperItems.push({ theme: entry.theme, src, width: entry.width, height: entry.height,
    surfaceYFraction: entry.recommendedSurfaceYFraction ?? shelves.recommendedSurfaceYFraction });
}
const baseline = [];
for (const entry of images.baselineResources) {
  const src = await copy(entry.files.webp.path, entry.imageId + ".webp", entry.files.webp.sha256);
  baseline.push({ id: entry.imageId, slot: entry.category, name: entry.name, stage: 0,
    theme: "basic", themeName: "기본", src, width: entry.width, height: entry.height });
}
const background = images.sceneResources.find((entry) => entry.imageId === "background");
await copy(background.files.webp.path, "background.webp", background.files.webp.sha256);
const data = {
  version: 2,
  themes: catalog.themes,
  categories: catalog.categories.map(({ id, name, stage, placement }) => ({ id, label: name, stage, placement })),
  items, baseline, shelves: helperItems,
  slots: room.slots, ledgeSlots: room.ledgeSlots,
};
await fs.writeFile(path.join(repo, "lib/readingHideoutCatalog.js"), "// Generated from the approved refined-v2 art delivery. Regenerate with scripts/import-hideout-art.mjs.\nexport const HIDEOUT_CATALOG_DATA = " + JSON.stringify(data, null, 2) + ";\n");
// Resting-pet originals are checked in separately from the furniture source delivery.
const restPetSpecies = [];
for (const species of ["owl", "hedgehog", "chick", "otter", "fennec", "redpanda", "rabbit", "bear", "cat", "puppy"]) {
  const relative = `pets/rest-${species}.webp`;
  const bytes = await fs.readFile(path.join(target, relative)).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (bytes) {
    files.push({ path: relative, bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    restPetSpecies.push(species);
  }
}
await fs.writeFile(path.join(target, "manifest.json"), JSON.stringify({ version: 2, catalogDesigns: 120, helperVariants: 4, baselineFurnishings: 7, restPetSpecies, files }, null, 2) + "\n");
console.log(JSON.stringify({ catalogDesigns: items.length, helperVariants: helperItems.length, baselineFurnishings: baseline.length, copiedFiles: files.length }));

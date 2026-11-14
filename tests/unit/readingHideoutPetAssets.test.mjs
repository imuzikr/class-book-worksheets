import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { HIDEOUT_ITEMS, HIDEOUT_DEFAULT_LAYOUT, hideoutSceneProps } from "../../lib/readingHideout.js";
import { PET_SPECIES_KEYS } from "../../lib/readingPet.js";
import { getHideoutRestPet, hideoutPetRestPosition, hideoutRestContentBounds, hideoutEggRestPosition } from "../../lib/readingHideoutPets.js";

const root = path.resolve("public");
const file = (src) => path.join(root, src.replace(/^\//, ""));
test("every approved imported file matches its source delivery hash and runtime item image exists", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "reading-hideout/manifest.json"), "utf8"));
  assert.equal(manifest.catalogDesigns, 120);
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(path.join(root, "reading-hideout", entry.path));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), entry.sha256, entry.path);
  }
  for (const item of HIDEOUT_ITEMS) {
    const meta = await sharp(file(item.src)).metadata();
    assert.equal(meta.hasAlpha, true, item.id);
    assert.deepEqual([meta.width, meta.height], [item.width, item.height], item.id);
  }
});
test("the secret egg exposes no species-specific resting image", () => {
  for (const species of PET_SPECIES_KEYS) assert.equal(getHideoutRestPet({ hatched: false, stage: 1, species }), null);
  assert.equal(getHideoutRestPet({ hatched: true, stage: 2, species: "unknown" }), null);
});
test("all ten resting pets fit inside every available bed without any opaque feet outside", async () => {
  const mask = async (src, width) => sharp(file(src)).resize(Math.round(width)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const bed of HIDEOUT_ITEMS.filter((item) => item.slot === "bed")) {
    const prop = hideoutSceneProps({ ...HIDEOUT_DEFAULT_LAYOUT, bed: bed.id }).find((item) => item.category === "bed");
    const body = await mask(bed.src, prop.width);
    for (const species of PET_SPECIES_KEYS) {
      const rest = getHideoutRestPet({ hatched: true, stage: 10, species });
      const placement = hideoutPetRestPosition(prop, bed.id, rest.contentBox);
      assert.equal(placement.width <= 120, true);
      const pet = await mask(rest.src, placement.width);
      let outside = 0;
      for (let y = 0; y < pet.info.height; y++) for (let x = 0; x < pet.info.width; x++) {
        if (pet.data[(y * pet.info.width + x) * 4 + 3] <= 128) continue;
        const wx = placement.x - pet.info.width / 2 + x, wy = placement.y - pet.info.height / 2 + y;
        const bx = Math.round(wx - (prop.x - body.info.width / 2)), by = Math.round(wy - (prop.y - body.info.height));
        if (bx < 0 || by < 0 || bx >= body.info.width || by >= body.info.height || body.data[(by * body.info.width + bx) * 4 + 3] < 128) outside++;
      }
      assert.equal(outside, 0, bed.id + "/" + species);
      assert.ok(hideoutRestContentBounds(placement));
    }
    assert.ok(hideoutEggRestPosition(prop, bed.id));
  }
});

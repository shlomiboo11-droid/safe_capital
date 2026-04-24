import { fal } from "@fal-ai/client";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

fal.config({ credentials: process.env.FAL_KEY });

const OUT_DIR = "/Users/shlomidavid/claudecode/test_imagesandvideos";
fs.mkdirSync(OUT_DIR, { recursive: true });

const PROMPT =
  "Editorial magazine photography of a woman on a tennis court at sunset, " +
  "golden hour lighting, shallow depth of field, cinematic, high fashion, " +
  "natural skin tones, soft backlight, warm tones, 85mm lens, sharp focus on subject, " +
  "Vogue style, photorealistic, 8K";

const MODELS_TO_TRY = [
  "fal-ai/nano-banana",
  "fal-ai/gemini-25-flash-image",
];

async function pickModel() {
  for (const m of MODELS_TO_TRY) {
    try {
      const r = await fal.subscribe(m, {
        input: { prompt: "test", num_images: 1 },
        logs: false,
      });
      if (r?.data?.images?.length) return m;
    } catch (e) {
      console.log(`model ${m} failed: ${e.message?.slice(0, 120)}`);
    }
  }
  throw new Error("No working model found");
}

async function generateOne(i, model) {
  console.log(`[${i}] generating via ${model}…`);
  const result = await fal.subscribe(model, {
    input: { prompt: PROMPT, num_images: 1 },
    logs: false,
  });
  const url = result?.data?.images?.[0]?.url;
  if (!url) throw new Error(`[${i}] no url returned`);
  const resp = await fetch(url);
  const buf = Buffer.from(await resp.arrayBuffer());
  const outPath = path.join(OUT_DIR, `editorial_0${i}.jpg`);
  fs.writeFileSync(outPath, buf);
  console.log(`[${i}] saved → ${outPath}`);
  return outPath;
}

const model = await pickModel();
console.log(`Using model: ${model}`);

const tasks = [1, 2, 3, 4, 5].map((i) => generateOne(i, model));
const results = await Promise.allSettled(tasks);
const ok = results.filter((r) => r.status === "fulfilled").length;
const failed = results.filter((r) => r.status === "rejected");
console.log(`\n✓ ${ok}/5 generated`);
failed.forEach((f, i) => console.log(`  fail: ${f.reason?.message || f.reason}`));

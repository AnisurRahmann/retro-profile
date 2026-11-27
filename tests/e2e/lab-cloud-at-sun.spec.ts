import { expect, test, type Page } from "@playwright/test";
import { densityGlsl } from "../../src/components/sky/volumetric/density.glsl";
import { LAB_DEFAULTS, type LabState } from "../../src/components/sky/volumetric/types";
import { sceneFor } from "../../src/lib/sky/volumetric/scene";
import { generateWeatherMap } from "../../src/lib/sky/volumetric/weather-map";

/**
 * cloudAtSun (owner T5; docs/volumetric/BRIEF.md §7 item 5): a dense cell forced over the sun hides the disc. The disc
 * centre's brightness (linear luminance of the screenshot) must drop by at least 85%.
 *
 * State A's sun (11:00, 40° up) is used, not B's: B's sun is 3.4° up and its ray crosses ~37 km of the cumulus
 * layer, so the ordinary field already hides it with cloudAtSun off and there is nothing to measure. (A's disc is
 * bright with the cell off: in the clear or glowing through a thin edge.)
 *
 * The march is far too slow on software GL (seconds a frame, and screenshots time out), so this file asks Chromium
 * for the GPU (ANGLE Metal on macOS). It reads a small clip around the disc, not the whole canvas.
 */
test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: {
    args: ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])],
  },
});

const W = 1440;
const H = 900;
const QUERY = "t=11:00&type=cumulus&cov=0.38&wind=15&from=270&freeze=1&tier=low";
const STATE: LabState = { ...LAB_DEFAULTS, t: "11:00", type: "cumulus", cov: 0.38, wind: 15, from: 270, freeze: true, tier: "low" };

// The forced cell needs T2's weather map and M1's removal of VOL_TEMP_NOISE (the temporary noise ignores the map's
// cells). Until both are on this branch the check can't mean anything, so it says why it is skipped.
const tempNoise = /^#define VOL_TEMP_NOISE 1/m.test(densityGlsl);
const cellMap = generateWeatherMap({ ...sceneFor(STATE).weather, forcedCell: { u: 0.5, v: 0.5, radius: 0.1 } });
const centre = (Math.floor(0.5 * 128) * 128 + Math.floor(0.5 * 128)) * 4;
const mapHonoursCell = cellMap[centre]! >= 0.95 * 255;

/** The sun's pixel (CSS px, y down) for the lab camera. */
function sunPixel(): [number, number] {
  const s = sceneFor(STATE);
  const c = s.camera;
  const d = s.sun.dir;
  const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const f = dot(d, c.forward);
  const x = ((dot(d, c.right) / f / (c.tanHalfFov * (W / H)) + 1) / 2) * W;
  const y = (1 - (dot(d, c.up) / f / c.tanHalfFov + 1) / 2) * H;
  return [x, y];
}

/** Mean linear luminance of a 5×5 box at (x, y) CSS px, from a small clip of the page around it. */
async function luminanceAt(page: Page, x: number, y: number): Promise<number> {
  const R = 10;
  const png = await page.screenshot({ clip: { x: Math.round(x) - R, y: Math.round(y) - R, width: 2 * R + 1, height: 2 * R + 1 }, scale: "css" });
  return page.evaluate(
    async ([b64, r]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(r - 2, r - 2, 5, 5).data;
      const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!);
      return sum / (d.length / 4);
    },
    [png.toString("base64"), R] as const,
  );
}

async function open(page: Page, cloudAtSun: "0" | "1"): Promise<void> {
  await page.goto(`/lab/clouds?${QUERY}&cloudAtSun=${cloudAtSun}`);
  await page.waitForFunction(() => (window.__vol?.frames ?? 0) > 8 || !!window.__vol?.error, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__vol!.error)).toBeNull();
}

test("cloudAtSun=1 hides the sun's disc (its centre loses ≥ 85%)", async ({ page }) => {
  test.skip(tempNoise, "needs M1: VOL_TEMP_NOISE still overrides the weather map's coverage");
  test.skip(!mapHonoursCell, "needs T2's weather map: the placeholder ignores forcedCell");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const [x, y] = sunPixel();
  expect(y).toBeGreaterThan(20);

  await open(page, "0");
  const clear = await luminanceAt(page, x, y);
  // Without the cell the disc is in the clear and near white, so the comparison means something.
  expect(clear).toBeGreaterThan(0.6);

  await open(page, "1");
  const covered = await luminanceAt(page, x, y);
  expect(covered, `disc centre ${clear.toFixed(3)} → ${covered.toFixed(3)}`).toBeLessThanOrEqual(0.15 * clear);
  expect(errors).toEqual([]);
});

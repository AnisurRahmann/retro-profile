/**
 * Noise textures on the GPU (owner T1): SHAPE, DETAIL and BLUE as typed in types.ts (NoiseTextures).
 * PLACEHOLDER (T0): flat SHAPE and DETAIL (every texel 0.5) and hashed white noise for BLUE, uploaded from the CPU.
 */
import { FLAT_NOISE_VALUE } from "@/lib/sky/volumetric/noise";
import { mulberry32 } from "@/lib/sky/random";
import { TIERS, type CreateNoiseTextures } from "./types";

function texture3d(gl: WebGL2RenderingContext, size: number, value: number): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, t);
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, size, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(size * size * size * 4).fill(value));
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const w of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, w, gl.REPEAT);
  return t;
}

export const createNoiseTextures: CreateNoiseTextures = async (gl, tier) => {
  const t0 = performance.now();
  const { shapeSize, detailSize } = TIERS[tier];
  const shape = texture3d(gl, shapeSize, FLAT_NOISE_VALUE);
  const detail = texture3d(gl, detailSize, FLAT_NOISE_VALUE);
  const rand = mulberry32(7);
  const px = new Uint8Array(64 * 64).map(() => Math.floor(rand() * 256));
  const blue = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, blue);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 64, 64, 0, gl.RED, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  return {
    shape,
    detail,
    blue,
    shapeSize,
    genMs: performance.now() - t0,
    dispose() {
      [shape, detail, blue].forEach((x) => gl.deleteTexture(x));
    },
  };
};

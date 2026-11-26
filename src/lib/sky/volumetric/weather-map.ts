/**
 * The weather map (owner T2): a pure generator (CPU) and its WebGL wrapper, typed in
 * src/components/sky/volumetric/types.ts (WeatherMapParams → WeatherMap).
 * PLACEHOLDER (T0): uniform coverage, type and precipitation; the offset scrolls with the wind.
 */
import {
  CLOUD_TYPE_VALUE,
  GEOMETRY,
  WEATHER_MAP_SIZE,
  type CreateWeatherMap,
  type GenerateWeatherMap,
  type Vec2,
  type WeatherMapParams,
} from "@/components/sky/volumetric/types";

/** The lab speeds the wind up so drift is visible (real 15 km/h moves a 2 km-high cloud ~2 px/s). T2 tunes. */
export const WIND_TIMELAPSE = 6;

const byte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);

export const generateWeatherMap: GenerateWeatherMap = (p) => {
  const out = new Uint8Array(WEATHER_MAP_SIZE * WEATHER_MAP_SIZE * 4);
  const [r, g, b] = [byte(p.coverage), byte(CLOUD_TYPE_VALUE[p.type]), byte(p.precipitation)];
  for (let i = 0; i < out.length; i += 4) {
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = 255;
  }
  return out;
};

/** The field's velocity in map uv per second: the wind blows toward fromDeg + 180 (u east, v north). */
export function windVelocity(windKmh: number, windFromDeg: number): Vec2 {
  const to = ((windFromDeg + 180) * Math.PI) / 180;
  const uvPerSec = ((windKmh / 3600) * WIND_TIMELAPSE) / GEOMETRY.WEATHER_MAP_KM;
  return [Math.sin(to) * uvPerSec, Math.cos(to) * uvPerSec];
}

const same = (a: WeatherMapParams, b: WeatherMapParams) => JSON.stringify(a) === JSON.stringify(b);

export const createWeatherMap: CreateWeatherMap = (gl, initial) => {
  const texture = gl.createTexture()!;
  let params: WeatherMapParams | null = null;
  const upload = (p: WeatherMapParams) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, WEATHER_MAP_SIZE, WEATHER_MAP_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, generateWeatherMap(p));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  };
  const map = {
    texture,
    offset: [0, 0] as Vec2,
    velocity: [0, 0] as Vec2,
    update(dtSec: number) {
      map.offset = [(((map.offset[0] + map.velocity[0] * dtSec) % 1) + 1) % 1, (((map.offset[1] + map.velocity[1] * dtSec) % 1) + 1) % 1];
    },
    setParams(p: WeatherMapParams) {
      map.velocity = windVelocity(p.windKmh, p.windFromDeg);
      if (params && same(params, p)) return;
      params = { ...p };
      upload(p);
    },
    dispose() {
      gl.deleteTexture(texture);
    },
  };
  map.setParams(initial);
  return map;
};

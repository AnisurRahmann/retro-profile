/**
 * The inline <head> script that paints the right sky before first paint (no suncalc, < 1.5 kB).
 * It estimates sun elevation with the NOAA simplified equations (declination + equation of time, ~±1°) and
 * reads the gradient from a table precomputed here, on the server, at 4° steps with the full OKLab pipeline.
 * Between table steps it mixes in sRGB, which at 4° apart is within ΔE_OK 0.03 (tested). The full renderer takes over
 * after hydration. Clear sky only: the weather isn't known yet.
 */
import { clearSky, toCss } from "./gradient";
import { SYLHET } from "./weather";

export const FP_STEP = 4;
export const FP_MIN = -18;
export const FP_MAX = 26;

/**
 * NOAA simplified solar position: (epoch ms) → [elevation°, hour angle°] for Sylhet. A JS expression, so the
 * test can evaluate exactly what ships.
 */
export const ELEVATION_SRC = `function(t){var M=Math,r=M.PI/180,y=new Date(t).getUTCFullYear(),g=2*M.PI/365*((t-Date.UTC(y,0,1))/864e5-.5),e=229.18*(75e-6+.001868*M.cos(g)-.032077*M.sin(g)-.014615*M.cos(2*g)-.040849*M.sin(2*g)),d=.006918-.399912*M.cos(g)+.070257*M.sin(g)-.006758*M.cos(2*g)+907e-6*M.sin(2*g),h=((t/6e4%1440+e+4*${SYLHET.lon})/4-180+540)%360-180,l=${SYLHET.lat}*r;return[M.asin(M.sin(l)*M.sin(d)+M.cos(l)*M.cos(d)*M.cos(h*r))/r,h]}`;

/** Precomputed table: per step, zenith, mid, dawn and dusk horizons (24 hex digits). */
export function firstPaintTable(): string {
  let out = "";
  for (let e = FP_MIN; e <= FP_MAX; e += FP_STEP) {
    const dawn = toCss(clearSky(e, "morning"));
    const dusk = toCss(clearSky(e, "evening"));
    out += (dawn.zenith + dawn.mid + dawn.horizon + dusk.horizon).replace(/#/g, "");
  }
  return out;
}

/**
 * @param debug honour ?sky=YYYY-MM-DDTHH:mm (Asia/Dhaka), like the client overrides.
 * Also sets html[data-sky] (night | civil | golden | day; the controller refines it to the exact state).
 */
export function firstPaintScript(debug: boolean): string {
  const dbg = debug
    ? `var m=location.search.match(/sky=(\\d+)-(\\d+)-(\\d+)T(\\d+):(\\d+)/);if(m)t=Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5])-216e5;`
    : "";
  const last = (FP_MAX - FP_MIN) / FP_STEP;
  return `(function(){var T="${firstPaintTable()}",t=Date.now(),D=document.documentElement;${dbg}var p=(${ELEVATION_SRC})(t),E=p[0],i=Math.min(Math.max((E+${-FP_MIN})/${FP_STEP},0),${last}),k=i|0,f=i-k,n=["zenith","mid","horizon"],q,b,o,v,x,z;function c(j,o){return parseInt(T.substr(j*24+o,2),16)}for(q=0;q<3;q++){o=q<2?q*6:p[1]<0?12:18;v="#";for(b=0;b<6;b+=2){x=c(k,o+b);z=c(Math.min(k+1,${last}),o+b);v+=(256|x+(z-x)*f+.5).toString(16).slice(1)}D.style.setProperty("--sky-"+n[q],v)}D.dataset.sky=E<=-6?"night":E<0?"civil":E<8?"golden":"day"})()`;
}

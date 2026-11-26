/**
 * Atmosphere fragment shader: clouds in perspective, fog band, moon glow, horizon glow and lightning, composited
 * front-to-back in linear light and written as premultiplied sRGB. Coordinates are CSS px with y down, so every
 * size below is in CSS px whatever the backing scale.
 * OKLab lightness ≈ cbrt(linear luminance), so "raise OKLab L by k%" ≈ scale linear RGB by (1 + k)³.
 *
 * Clouds (Weather v6; the numbers are src/lib/sky/clouds.ts). Three sheets in perspective, drawn back to front.
 * A pixel at v (0 at the cloud horizon uCloudHz, 1 at the top of the viewport) sees the sheet at height h at a
 * distance z = h / v and x = (px − ½W)·z / (0.9·W), so clouds are largest overhead and shrink toward the horizon.
 * uHi, uMi, uLo and uSc are each (x, s, evolution, coverage): where the sheet is sampled (the wind, integrated on
 * the CPU) and how much of it is cloud; uTh is the density that coverage means, solved on the CPU, and each sheet's
 * soft edge (EDGE, SOFT) is centred on it, so the coverage is the share of the sky past the middle of the ramp.
 * A sheet's depth is read in logs (clouds.ts planePoint), so a cloud keeps its proportions at every distance and
 * shrinks with v. The footprint (fp, the noise under one atmosphere pixel) is the same along both axes, and small:
 * octaves finer than it are not sampled. Every sheet fades over the last 4% above the horizon.
 * - HIGH: cirrus, fbm stretched 5:1 along the wind (uWindv). Thin: lit most where it is near the light. Alpha ≤ 0.35.
 * - MID: altocumulus. A low-frequency mask picks the patches; Worley cells, each shaded as a dome, fill them.
 *   Alpha ≤ 0.6.
 * - LOW: cumulus. fbm on a domain warped twice, times a Worley "billow" (1 − F1) for puffy edges; a stratus deck
 *   (overcast, drizzle: uStyle.z) takes 0.2 of the billow and is thick everywhere (clouds.ts STRATUS). Alpha ≤ 0.95. Its normal is the cell's (the vector to the centre
 *   of its Worley cell, which the cellular lookup already returns) over the fbm's own slope, so a distant cloud has
 *   a lit top and a shaded base too.
 * - SCUD: small fast fragments under a rain deck.
 * Lighting: Lambert on the normal from the sun's (or the moon's) screen position, plus a Henyey–Greenstein phase
 * (g 0.65) toward the light: the silver lining on cloud edges near the sun. Beer–Lambert darkens thick cores.
 * The colours are palette CLOUD_* (the only hex in the sky): by day a lit top on a blue-grey base; at golden
 * hour the horizon colour +15% L, undersides warm, tops blue-grey; after sunset the daylight fades out of them over
 * 2–6° (uTwilight) to the sky's own colours; at night dark shapes with moonlit edges and the city's glow on the LOW
 * sheet's undersides; in rain a grey deck. src/components/sky/cloud-field.ts mirrors
 * it on the CPU: the sun's and moon's occlusion, and the cloud the backing model counts.
 * Fog: desaturated sky lifted +6% L, alpha uFog × 0.55, strongest toward the horizon. Moon glow: radial halo,
 * illumination × up × night × (1 − 0.7 cover). Horizon glow: ellipse on the horizon line under the sun. Lightning
 * (until W4): a lift of the cloud layer only. The horizon line is uHorizonY (CSS px): the viewport bottom on
 * desktop; in scene mode it tracks the visible ground, and under a scene the sky is back to the "away" sky (horizon
 * at 1.45 vh) by uHorizonB (src/lib/sky/horizon.ts). Nothing is damped anywhere: there is no column scrim. Loose
 * text gets per-element backing (src/lib/sky/backing.ts), which mirrors these layers.
 */
import { hexToRgb, toLinear } from "@/lib/sky/color";
import {
  CELLS_PER_UNIT,
  EDGE,
  FOCAL,
  HAZE,
  NOISE_SIZE,
  SHEET,
  SLOPE,
  STRATUS,
  V_MIN,
  type SheetId,
} from "@/lib/sky/clouds";
import {
  CITY_GLOW,
  CLOUD_LIT,
  CLOUD_LIT_RAIN,
  CLOUD_SHADOW,
  CLOUD_SHADOW_RAIN,
  CLOUD_TOP_GOLD,
  CLOUD_UNDER_GOLD,
  MOONLIGHT,
  NIGHT_SHADOW,
} from "@/lib/sky/palette";

/** Cirrus: fbm octaves. LOW is 4 (hand-inlined), MID a patch mask and its cells, SCUD 2: what the GPU budget pays for. */
const HIGH_OCTAVES = 3;
/** The softness of a cirrus and a SCUD edge, in noise. */
const SOFT = { high: 0.25, scud: 0.15 } as const;

/** An sRGB hex as a linear vec3 literal. */
const gl = (hex: string) => `vec3(${hexToRgb(hex).map((v) => toLinear(v).toFixed(3)).join(",")})`;
/** A number as a GLSL float literal ("9", an int, is no operand for a float). */
const FL = (v: number) => v.toFixed(2);

/** `float fbmN(p, fp)`: N octaves of value noise, each rotated by R, twice as fine and half as strong, about their
 *  mean. An octave whose wavelength is under about two pixels of the footprint `fp` is not sampled at all. */
function fbmFn(n: 2 | 3): string {
  let s = `float fbm${n}(vec2 p,float fp){float v=0.,k=1.5-2.5*fp,a=.5;`;
  for (let i = 0; i < n; i++)
    s += `if(k>0.)v+=a*(mix(.5,vn(p),min(k,1.))-.5);p=R*p;k-=${FL(2.5 * 2 ** (i + 1))}*fp;a*=.5;`;
  return `${s}return v;}`;
}

/** The plane a pixel looks at on a sheet. Declares q (its noise coordinates, with the sheet's drift) and fp (the
 *  noise under one atmosphere pixel): call it in its own scope. vc, px and dk (depthK) come from main. */
const plane = (s: SheetId, u: string) => {
  const { h, freq } = SHEET[s];
  return `float z=${FL(h)}/vc;
vec2 q=(vec2((css.x-.5*vp.x)/(.9*vp.x)*z,${FL(h)}*dk*log(z/${FL(h)}))+${u}.xy)*${FL(freq)};
float fp=px*z*${FL(freq)}/(.9*vp.x);`;
};
/** MID and LOW: their cells' footprint (kc: 1 keeps them, 0 is their mean). */
const MID_KC = `clamp(1.5-${FL(2.5 * CELLS_PER_UNIT.mid)}*fp,0.,1.)`;
const LOW_KC = `clamp(1.5-${FL(2.5 * CELLS_PER_UNIT.low)}*fp,0.,1.)`;

export const VERT = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;

export const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uScale,uTime,uSunX,uGlow,uCloudCover,uFog,uRainDark,uLightning,uMoonIllum,uMoonUp,uNight,uGolden,uTwilight;
uniform vec2 uMoonPos;
uniform float uHorizonY,uHorizonB,uCloudHz;
uniform vec3 uZenith,uMid,uHorizon;
uniform sampler2D uNoise,uCells;
uniform vec4 uHi,uMi,uLo,uSc,uTh,uLight;
uniform vec2 uWindv;
uniform vec4 uStyle;
out vec4 o;
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture(uNoise,(i+f+.5)/${NOISE_SIZE}.).r;}
vec2 vn2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture(uNoise,(i+f+.5)/${NOISE_SIZE}.).rg;}
// Worley: the vector from a point to the centre of its cell.
vec2 cellv(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return texture(uCells,(i+f+.5)/${NOISE_SIZE}.).rg*2.5-1.25;}
const mat2 R=mat2(1.6,1.2,-1.2,1.6),RC=mat2(.8,.6,-.6,.8);
const vec3 TOP=${gl(CLOUD_TOP_GOLD)},UNDER=${gl(CLOUD_UNDER_GOLD)},CITY=${gl(CITY_GLOW)};
// The sky gradient (one parameter, 0 zenith … 1 horizon), compositing and the sRGB transfer.
float skyP(float y,float A){if(y<=uHorizonY)return uHorizonY>0.?max(y,0.)/uHorizonY:1.;if(y<=uHorizonB)return mix(1.,min(1.,uHorizonB/A),(y-uHorizonY)/max(uHorizonB-uHorizonY,1e-3));return clamp(y/A,0.,1.);}
vec3 sky(float y){return y<.55?mix(uZenith,uMid,y/.55):mix(uMid,uHorizon,(y-.55)/.45);}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
void over(inout vec4 acc,vec3 c,float a){acc.rgb+=c*a*(1.-acc.a);acc.a+=a*(1.-acc.a);}
vec3 toGamma(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
${fbmFn(2)}
${fbmFn(3)}
vec3 l;float ph;
// Henyey–Greenstein (g 0.65) on the angle between the view and the light: 1 in the light's direction.
float phase(float c){float x=1.4225-1.3*c;return .0429/(x*sqrt(x));}
// A cloud's colour: lit where it faces the light and where the light comes through it toward us; thick cores dark.
// By moonlight only the edges that face the moon are lit.
vec3 shade(float dens,vec2 n,float thick,vec3 lit,vec3 shd){
float k=clamp(max(dot(n,l.xy),0.)*uLight.w*mix(.7,.28,uNight)+ph*.6,0.,1.);
return mix(shd,lit,k)*(.35+.65*exp(-dens*thick*2.2));
}
// Golden hour: undersides glow, tops go blue-grey.
vec3 gold(vec3 lit,float under,float top){return mix(lit,mix(mix(uHorizon*1.521,TOP,.6*top),UNDER,.6*under),uGolden*uTwilight);}
vec3 flash(vec3 c){if(uLightning<=0.)return c;float L=pow(max(luma(c),1e-5),1./3.);return c*pow((L+.12*uLightning)/L,3.);}
// LOW: its density and its normal; under and top: whether this is the underside or the top of its cloud.
vec4 lowCloud(vec2 q,float fp,float evo,float th,out float under,out float top){
vec2 w1=vn2(q*.5+vec2(1.7,9.2)+evo*vec2(1.,.6))-.5;
vec2 w2=vn2((q+uStyle.y*w1)*.5+vec2(8.3,2.8)-evo*vec2(.7,1.))-.5;
vec2 qw=q+uStyle.y*(w1+w2);
float k=1.5-2.5*fp;
// The first octave here, just up-screen and just to the right: the cloud's slope.
float o0=mix(.5,vn(qw),clamp(k,0.,1.)),o1=mix(.5,vn(qw-vec2(0.,.12)),clamp(k,0.,1.)),o2=mix(.5,vn(qw+vec2(.12,0.)),clamp(k,0.,1.));
qw=R*qw;k-=5.*fp;
float f=.5*o0+.21875;
if(k>0.)f+=.25*(mix(.5,vn(qw),min(k,1.))-.5);
qw=R*qw;k-=10.*fp;
if(k>0.)f+=.125*(mix(.5,vn(qw),min(k,1.))-.5);
qw=R*qw;
k-=20.*fp;
if(k>0.)f+=.0625*(mix(.5,vn(qw),min(k,1.))-.5);
float kc=${LOW_KC};
vec2 c=kc>0.?cellv(RC*q*${FL(CELLS_PER_UNIT.low)})*kc:vec2(0.);
float d=f*mix(1.,mix(.5,1.-length(c),kc),uStyle.x);
// A stratus deck (uStyle.z) is thick everywhere: a thin patch is only brighter, not a rimmed hole, and its edge is soft.
d=mix(d,${FL(STRATUS.floor)}+${FL(1 - STRATUS.floor)}*d,uStyle.z);
under=max(smoothstep(.02,.12,o1-o0),c.y*2.5);top=max(smoothstep(.02,.12,o0-o1),-c.y*2.5);
vec2 nrm=normalize(vec3(c*2.5+vec2(o0-o2,o1-o0)*${FL(SLOPE)},1.)).xy;
// The ramp is centred on the threshold, so a coverage is the share of sky past the ramp's middle.
float e=.5*mix(${FL(EDGE)},${FL(STRATUS.edge)},uStyle.z);
return vec4(smoothstep(th-e,th+e,d),nrm,0.);
}
// MID: a patch of altocumulus is many rounded cells: a low-frequency mask picks the patches, the cell domes fill them.
float midCloud(vec2 q,float fp,float th,out vec2 n){
float kc=${MID_KC};
vec2 c=kc>0.?cellv(RC*q*${FL(CELLS_PER_UNIT.mid)})*kc:vec2(0.);
n=normalize(vec3(c*2.5,1.)).xy;
return smoothstep(th-${FL(EDGE / 2)},th+${FL(EDGE / 2)},vn(q*.25+vec2(3.1,7.7))*(.4+.6*mix(.5,1.-length(c),kc)));
}
void main(){
vec2 css=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uScale;
vec2 vp=uRes/uScale;
float p=skyP(css.y,1.45*vp.y);
vec3 base=sky(p);
vec4 acc=vec4(0.);
float v=(uCloudHz-css.y)/uCloudHz;
if(v>0.){
float vc=max(v,${FL(V_MIN)}),px=1./uScale,dk=uCloudHz/(.9*vp.x);
// The light: the sun's or the moon's place on screen, 0.6 deep.
vec2 lc=uLight.xy;
l=normalize(vec3((lc-css)/vp.y,.6));
vec2 ctr=vec2(.5*vp.x,uCloudHz);
float focal=${FL(FOCAL)}*vp.x;
ph=phase(dot(normalize(vec3((css-ctr)/focal,1.)),normalize(vec3((lc-ctr)/focal,1.))))*uLight.w;
// Twilight (uTwilight, 1 above 2° under the sun, 0 at 6°): with the sun down the daylight goes out of the cloud and
// what is left is the sky's own light, horizon colour on its lit side and mid colour on its shaded side.
vec3 shd=mix(uMid*.6,mix(${gl(CLOUD_SHADOW)},${gl(NIGHT_SHADOW)},uNight),uTwilight);
vec3 lit=mix(uHorizon*1.2,mix(${gl(CLOUD_LIT)},${gl(MOONLIGHT)}*(.2+.8*uMoonIllum*uMoonUp),uNight),uTwilight);
shd=mix(shd,${gl(CLOUD_SHADOW_RAIN)},uRainDark);lit=mix(lit,${gl(CLOUD_LIT_RAIN)},uRainDark);
float haze=smoothstep(0.,${FL(HAZE)},v)*(1.-.6*uFog);
if(uLo.w>.001){
${plane("low", "uLo")}
float under,top;
vec4 c=lowCloud(q,fp,uLo.z,uTh.z,under,top);
// A stratus deck is opaque to STRATUS.opaque: no blue sky through its thin patches.
float op=mix(c.x,max(c.x,${FL(STRATUS.opaque)}),uStyle.z);
if(op>0.)over(acc,flash(shade(c.x,c.yz,${FL(SHEET.low.thick)},gold(lit+CITY*.35*under*uNight,under,top),shd)),op*${FL(SHEET.low.alpha)}*haze);
}
if(uSc.w>.001){
${plane("scud", "uSc")}
float d=smoothstep(uTh.w-${FL(SOFT.scud / 2)},uTh.w+${FL(SOFT.scud / 2)},fbm2(q,fp));
if(d>0.)over(acc,flash(shade(d,vec2(0.),${FL(SHEET.scud.thick)},gold(lit,0.,0.),shd)),d*${FL(SHEET.scud.alpha)}*haze);
}
if(uMi.w>.001){
${plane("mid", "uMi")}
vec2 n;
float d=midCloud(q,fp,uTh.y,n);
if(d>0.)over(acc,flash(shade(d,n,${FL(SHEET.mid.thick)},gold(lit,max(n.y*2.5,0.),max(-n.y*2.5,0.)),shd)),d*${FL(SHEET.mid.alpha)}*haze);
}
if(uHi.w>.001){
${plane("high", "uHi")}
vec2 w=uWindv.xy,ac=vec2(-w.y,w.x);
vec2 s2=vec2(dot(w,q)/${FL(SHEET.high.stretch)},dot(ac,q));
float d=smoothstep(uTh.x-${FL(SOFT.high / 2)},uTh.x+${FL(SOFT.high / 2)},fbm${HIGH_OCTAVES}(s2,fp));
if(d>0.)over(acc,flash(mix(shd,lit,clamp(.3+.7*ph,0.,1.))*(.35+.65*exp(-d*${FL(SHEET.high.thick)}*2.2))),d*${FL(SHEET.high.alpha)}*haze);
}
}
if(uFog>.001){
vec3 f=mix(vec3(luma(base)),base,.4)*1.19;
over(acc,f,uFog*.55*smoothstep(.35,1.,p));
}
float mg=uMoonIllum*uMoonUp*uNight*(1.-.7*uCloudCover);
if(mg>.001){
float r=length((css-uMoonPos*vp))/110.;
over(acc,vec3(.62,.66,.76),mg*.16*exp(-r*r*.9));
}
if(uGlow>.001){
vec2 e=(css-vec2(uSunX*vp.x,css.y<=uHorizonB?uHorizonY:1.45*vp.y))/vec2(.9*vp.x,.42*vp.y);
float g=exp(-dot(e,e)*2.2);
over(acc,uHorizon*1.331,uGlow*.75*g);
}
o=acc.a>0.?vec4(toGamma(acc.rgb/acc.a)*acc.a,acc.a):vec4(0.);
}`;

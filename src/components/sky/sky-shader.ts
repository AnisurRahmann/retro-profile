/**
 * Atmosphere fragment shader: the sky gradient with the fog band, moon glow, horizon glow, rain curtains, a storm's
 * dark base and lightning, composited front-to-back in linear light and written as premultiplied sRGB. Coordinates
 * are CSS px with y down, so every size below is in CSS px whatever the backing scale.
 * OKLab lightness ≈ cbrt(linear luminance), so "raise OKLab L by k%" ≈ scale linear RGB by (1 + k)³.
 *
 * There are no clouds here: they are flat paper-cut shapes on their own Canvas 2D layer in front of this one
 * (src/components/sky/flat-cloud-layer.ts, the model src/lib/sky/flat-clouds.ts).
 * - Fog: the sky desaturated and lifted, 55% of it, rising to 85% where the land begins (uCloudHz).
 * - Moon glow: a radial halo, illumination × up × night × (1 − 0.7 cover).
 * - Horizon glow: an ellipse on the horizon line under the sun, halved under a storm.
 * - Rain: the whole sky 10% darker under the heaviest; curtains of heavier rain drifting with the wind (uWindX), in
 *   heavy rain and thunder only (uRainDark ≥ 0.8), at alpha ≤ 0.12. A two-octave hashed value noise: no texture.
 * - A storm's base (uStorm): the top of the sky, eased from 55% up to 20% of the viewport, 30% darker.
 * - Lightning (W4): the whole sky +5% L for a bolt, +25% L over a soft disc for a sheet flash (uSheet).
 * The horizon line is uHorizonY (CSS px): the viewport bottom on desktop; in scene mode it tracks the visible ground,
 * and under a scene the sky is back to the "away" sky (horizon at 1.45 vh) by uHorizonB (src/lib/sky/horizon.ts).
 * Nothing is damped anywhere: there is no column scrim. Loose text gets per-element backing (src/lib/sky/backing.ts),
 * which mirrors these layers.
 */
export const VERT = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;

export const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uScale,uTime,uSunX,uGlow,uCloudCover,uFog,uRainDark,uLightning,uMoonIllum,uMoonUp,uNight,uStorm,uWindX;
uniform vec2 uMoonPos;
uniform float uHorizonY,uHorizonB,uCloudHz;
uniform vec3 uZenith,uMid,uHorizon;
uniform vec4 uSheet;
out vec4 o;
float hs(vec2 p){p=fract(p*vec2(.1031,.103));p+=dot(p,p.yx+33.33);return fract((p.x+p.y)*p.x);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+1.),f.x),f.y);}
// The sky gradient (one parameter, 0 zenith … 1 horizon), compositing and the sRGB transfer.
float skyP(float y,float A){if(y<=uHorizonY)return uHorizonY>0.?max(y,0.)/uHorizonY:1.;if(y<=uHorizonB)return mix(1.,min(1.,uHorizonB/A),(y-uHorizonY)/max(uHorizonB-uHorizonY,1e-3));return clamp(y/A,0.,1.);}
vec3 sky(float y){return y<.55?mix(uZenith,uMid,y/.55):mix(uMid,uHorizon,(y-.55)/.45);}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
void over(inout vec4 acc,vec3 c,float a){acc.rgb+=c*a*(1.-acc.a);acc.a+=a*(1.-acc.a);}
vec3 toGamma(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
void main(){
vec2 css=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uScale;
vec2 vp=uRes/uScale;
float p=skyP(css.y,1.45*vp.y);
vec3 base=sky(p)*(1.-.3*smoothstep(.55*vp.y,.2*vp.y,css.y)*uStorm);
vec4 acc=vec4(0.);
// Fog: the sky desaturated 60% and lifted, 55% of it, rising to 85% where the land begins (uCloudHz: the far
// hills' skyline), so the foggy land and the sky above it meet in the same colour.
if(uFog>.001){
vec3 f=mix(vec3(luma(base)),base,.4)*1.19;
over(acc,f,uFog*mix(.55,.85,smoothstep(.45,1.,clamp(css.y/max(uCloudHz,1.),0.,1.)))*smoothstep(.35,1.,p));
}
float mg=uMoonIllum*uMoonUp*uNight*(1.-.7*uCloudCover);
if(mg>.001){
float r=length((css-uMoonPos*vp))/110.;
over(acc,vec3(.62,.66,.76),mg*.16*exp(-r*r*.9));
}
if(uGlow>.001){
vec2 e=(css-vec2(uSunX*vp.x,css.y<=uHorizonB?uHorizonY:1.45*vp.y))/vec2(.9*vp.x,.42*vp.y);
float g=exp(-dot(e,e)*2.2);
over(acc,uHorizon*1.331,uGlow*.75*g*(1.-.5*uStorm));
}
// Rain curtains: heavy rain and thunder only, vertically stretched noise drifting with the wind.
float cur=smoothstep(.8,1.,uRainDark);
if(cur>.001){
vec2 cu=vec2(css.x/(.9*vp.x)*3.5-uTime*.06*uWindX,css.y/vp.y*.5);
float n=.65*vn(cu)+.35*vn(cu*2.03+vec2(5.2,1.3));
over(acc,uHorizon*.5,.12*cur*smoothstep(.4,.8,n));
}
// The whole sky, the gradient behind this layer included: 10% darker under the heaviest rain; lightning lifts it
// (OKLab L) by +5% for a bolt (uLightning) and +25% over a soft disc for a sheet flash in the cloud (uSheet).
vec3 allc=(acc.rgb+(1.-acc.a)*base)*(1.-.1*uRainDark);
// Only while something is striking: three powers on every pixel is not free.
if(uLightning>0.||uSheet.w>0.){
float L=pow(max(luma(allc),1e-5),1./3.);
float lk=.05*uLightning;
if(uSheet.w>0.)lk+=.25*uSheet.w*exp(-pow(length(css-uSheet.xy)/max(uSheet.z,1.),2.)*2.2);
allc*=pow((L+lk)/L,3.);
}
o=vec4(toGamma(allc),1.);
}`;

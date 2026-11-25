/**
 * Atmosphere fragment shader: horizon glow, moon glow, clouds (value-noise fbm, domain-warped once), fog band and
 * lightning, composited front-to-back in linear light and written as premultiplied sRGB. Coordinates are CSS px
 * with y down, so every size below is in CSS px whatever the backing scale.
 * OKLab lightness ≈ cbrt(linear luminance), so "raise OKLab L by k%" ≈ scale linear RGB by (1 + k)³.
 *
 * Layers, nearest first:
 * - Clouds: q = CSS px drifting with the wind, squashed toward the horizon. fbm (3 + 2 octaves) on a domain warped
 *   once by two 3-octave fbms; the sum is stretched (×1.9 around 0.48) so the coverage threshold
 *   mix(0.85, 0.25, cover) means what it says. Tops are where density falls off upward (one extra 3-octave sample).
 *   Day: the sky greyed halfway, cores level, tops +12% L; golden hour leans the undersides to the horizon colour.
 *   Night: near-black silhouettes, rim-lit near the moon. Rain greys and darkens the deck. Lightning adds +0.12
 *   OKLab L to the cloud layer only. Alpha ≤ 0.85, reduced by fog (fog swallows cloud structure).
 * - Fog: desaturated sky lifted +6% L, alpha uFog × 0.55, strongest across the bottom 40%.
 * - Moon glow: radial halo, illumination × up × night × (1 − 0.7 cover).
 * - Horizon glow: ellipse on the bottom edge under the sun (0.9 × width), horizon colour +10% L.
 * Clouds and the glow are damped to COLUMN_DAMP behind the 768px column (ramping out over 96px), which the scrim
 * solver mirrors.
 */
import { COLUMN_DAMP, MOON_COLUMN_PX } from "@/lib/sky/scrim";

export const OCTAVES = 5;

export const VERT = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;

export const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uScale,uTime,uSunX,uGlow,uCloudCover,uFog,uRainDark,uLightning,uMoonIllum,uMoonUp,uNight,uDay,uGolden;
uniform vec2 uWind,uMoonPos;
uniform vec3 uZenith,uMid,uHorizon;
out vec4 o;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
const mat2 R=mat2(1.6,1.2,-1.2,1.6);
float fbm3(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=R*p;a*=.5;}return v;}
float detail(vec2 p){p=R*R*R*p;float v=0.,a=.0625;for(int i=3;i<${OCTAVES};i++){v+=a*noise(p);p=R*p;a*=.5;}return v;}
vec3 sky(float y){return y<.55?mix(uZenith,uMid,y/.55):mix(uMid,uHorizon,(y-.55)/.45);}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
void over(inout vec4 acc,vec3 c,float a){acc.rgb+=c*a*(1.-acc.a);acc.a+=a*(1.-acc.a);}
vec3 toGamma(vec3 c){return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
void main(){
vec2 css=vec2(gl_FragCoord.x,uRes.y-gl_FragCoord.y)/uScale;
vec2 vp=uRes/uScale;
vec2 uv=css/vp;
vec3 base=sky(uv.y);
vec4 acc=vec4(0.);
float col=1.-${COLUMN_DAMP}*(1.-smoothstep(${MOON_COLUMN_PX / 2}.,${MOON_COLUMN_PX / 2 + 96}.,abs(css.x-vp.x*.5)));
float cloudA=0.;
if(uCloudCover>.005){
vec2 q=(css-uWind*uTime)/vec2(400.,190.+210.*(1.-uv.y));
vec2 w=vec2(fbm3(q*.6+vec2(1.7,9.2)),fbm3(q*.6+vec2(8.3,2.8)+uTime*.004));
vec2 qw=q+1.6*(w-.5);
float lo=fbm3(qw);
float d=(lo+detail(qw)-.48)*1.9+.5;
float th=mix(.85,.25,uCloudCover);
float dens=smoothstep(th,th+.22,d);
if(dens>0.){
float up=fbm3(qw+vec2(0.,-.09));
float top=clamp((lo-up)*9.+.5,0.,1.);
float thick=smoothstep(th,th+.5,d);
vec3 grey=mix(vec3(luma(base)),base,.5);
vec3 day=mix(grey*.95,grey*1.405,top);
day=mix(day,mix(day,uHorizon*1.1,.55),uGolden*(1.-top)*.9);
vec3 night=base*.55;
float md=length((css-uMoonPos*vp)/vp.y);
night+=vec3(.55,.58,.66)*uMoonUp*uMoonIllum*(1.-thick)*.35*exp(-md*md*14.);
vec3 c=mix(night,day,uDay);
c=mix(c,vec3(luma(c)),.4*uRainDark)*(1.-.32*uRainDark*thick);
float L=pow(max(luma(c),1e-5),1./3.);
c*=pow((L+.12*uLightning)/L,3.);
cloudA=dens*mix(.55,.85,thick)*mix(1.,1.08,uRainDark);
cloudA=min(cloudA,.85)*(1.-.6*uFog)*col;
over(acc,c,cloudA);
}
}
if(uFog>.001){
vec3 f=mix(vec3(luma(base)),base,.4)*1.19;
over(acc,f,uFog*.55*smoothstep(.35,1.,uv.y));
}
float mg=uMoonIllum*uMoonUp*uNight*(1.-.7*uCloudCover);
if(mg>.001){
float r=length((css-uMoonPos*vp))/110.;
over(acc,vec3(.62,.66,.76),mg*.16*exp(-r*r*.9));
}
if(uGlow>.001){
vec2 e=(css-vec2(uSunX*vp.x,vp.y))/vec2(.9*vp.x,.42*vp.y);
float g=exp(-dot(e,e)*2.2);
over(acc,uHorizon*1.331,uGlow*.75*g*col);
}
o=acc.a>0.?vec4(toGamma(acc.rgb/acc.a)*acc.a,acc.a):vec4(0.);
}`;

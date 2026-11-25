import { SF } from "@/lib/signal-math";

const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/**
 * Instanced dots. One instance per grid cell; the vertex shader evaluates the intensity function
 * (mirroring src/lib/signal-math.ts) once per dot at the cell centre and expands a quad just large enough
 * for the anti-aliased disc. The fragment shader only computes disc coverage, so only dot pixels rasterize.
 * (A full-screen triangle costs ~1 ms at 3840×2160 on an M2 before doing any work; see docs/DECISIONS.md.)
 */
export const VERT = `#version 300 es
precision highp float;
#define N ${SF.maxEmitters}
uniform vec2 uRes;uniform float uDpr,uT,uGain,uVw,uCols;uniform vec2 uC;
uniform vec4 uE[N];uniform float uE0[N];
uniform vec3 uG,uX,uS;
out vec2 vL;out float vR,vA;out vec3 vCol;
float h(vec2 p){return fract(sin(p.x*127.1+p.y*311.7)*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.0-2.0*u);
return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y)*2.0-1.0;}
float idle(vec2 p){float n=vn(vec2(p.x*${f(SF.noiseScale)},p.y*${f(SF.noiseScale)}+uT*${f(SF.noiseTime)}));
return ${f(SF.idleAmp)}*(0.5+0.5*sin(${f((2 * Math.PI) / SF.idleLambda)}*p.x-${f((2 * Math.PI) / SF.idlePeriod)}*uT+${f(SF.noiseWarp)}*n));}
float cur(vec2 p){vec2 d=p-uC;return ${f(SF.cursorGain)}*uGain*exp(-dot(d,d)/${f(SF.sigma * SF.sigma)});}
float rip(vec2 p){float s=0.0;for(int i=0;i<N;i++){float a=uT-uE0[i];if(a<0.0)continue;
float A=uE[i].z*exp(-a/uE[i].w);if(A<=${f(SF.activeEps)})continue;
float fr=length(p-uE[i].xy)-${f(SF.v)}*a;s+=A*exp(-fr*fr/${f(SF.wr * SF.wr)});}return s;}
float mask(float x){if(uVw<${f(SF.columnBreak)})return ${f(SF.column)};
return mix(${f(SF.column)},1.0,smoothstep(0.0,${f(SF.columnEdge)},abs(x-uVw*0.5)-${f(SF.columnHalf)}));}
void main(){
float k=float(gl_InstanceID);
vec2 c=(vec2(mod(k,uCols),floor(k/uCols))+0.5)*${f(SF.pitch)};
float m=mask(c.x),r=rip(c),I0=clamp(idle(c)+cur(c)+r,0.0,1.0),I=I0*m;
vR=(${f(SF.rBase)}+${f(SF.rGain)}*I)*uDpr;
vA=mix(${f(SF.aMin)},${f(SF.aMax)},I0)*m;
vCol=mix(mix(uG,uX,I),uS,${f(SF.amberMax)}*smoothstep(0.5,1.0,r*m));
vL=(vec2(float(gl_VertexID&1),float(gl_VertexID>>1))*2.0-1.0)*(vR+${f(SF.aa)});
vec2 d=c*uDpr+vL;
gl_Position=vec4(d.x/uRes.x*2.0-1.0,1.0-d.y/uRes.y*2.0,0.0,1.0);}`;

export const FRAG = `#version 300 es
precision highp float;
in vec2 vL;in float vR,vA;in vec3 vCol;out vec4 o;
void main(){float a=smoothstep(vR+${f(SF.aa)},vR-${f(SF.aa)},length(vL))*vA;o=vec4(vCol*a,a);}`;

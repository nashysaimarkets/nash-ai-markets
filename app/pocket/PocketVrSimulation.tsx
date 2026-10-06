"use client";

/* Pocket's uploaded chart is a private data URL rendered directly into a local WebGL texture. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";

type Analysis = {
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  instrument: string;
  timeframe: string;
  verdict: "WATCH" | "WAIT" | "STAND_ASIDE" | "REVIEW_REQUIRED";
  verdictHeadline: string;
  summary: string;
  marketStructure: string;
  levelStory: string;
  whatYouMayBeMissing: string[];
  contradictions: string[];
  riskFlags: string[];
  traderTrap: string;
  bullishCase: string;
  bearishCase: string;
  setupScore: { overall: number; grade: string };
  nextSequence: { now: string; confirmation: string; failure: string; reassess: string };
  levels: { kind: string; price: string; y: number }[];
};

type Props = {
  analysis: Analysis;
  sourceImage: string;
  viewerName: string;
  intention: "LONG" | "SHORT" | "UNSURE";
  onOpenReport: (target?: string) => void;
  onShare: () => void;
};

type Vec3 = [number, number, number];
type Mat4 = Float32Array;

const CUBE = new Float32Array([
  // x y z, nx ny nz, u v
  -1,-1, 1, 0,0,1, 0,0,  1,-1, 1, 0,0,1, 1,0,  1, 1, 1, 0,0,1, 1,1,
  -1,-1, 1, 0,0,1, 0,0,  1, 1, 1, 0,0,1, 1,1, -1, 1, 1, 0,0,1, 0,1,
   1,-1,-1, 0,0,-1,0,0, -1,-1,-1,0,0,-1,1,0, -1,1,-1,0,0,-1,1,1,
   1,-1,-1, 0,0,-1,0,0, -1, 1,-1,0,0,-1,1,1,  1,1,-1,0,0,-1,0,1,
  -1,-1,-1,-1,0,0,0,0, -1,-1, 1,-1,0,0,1,0, -1,1, 1,-1,0,0,1,1,
  -1,-1,-1,-1,0,0,0,0, -1, 1, 1,-1,0,0,1,1, -1,1,-1,-1,0,0,0,1,
   1,-1, 1, 1,0,0,0,0,  1,-1,-1,1,0,0,1,0,  1,1,-1,1,0,0,1,1,
   1,-1, 1, 1,0,0,0,0,  1, 1,-1,1,0,0,1,1,  1,1, 1,1,0,0,0,1,
  -1, 1, 1, 0,1,0,0,0,  1, 1, 1,0,1,0,1,0,  1,1,-1,0,1,0,1,1,
  -1, 1, 1, 0,1,0,0,0,  1, 1,-1,0,1,0,1,1, -1,1,-1,0,1,0,0,1,
  -1,-1,-1, 0,-1,0,0,0, 1,-1,-1,0,-1,0,1,0, 1,-1,1,0,-1,0,1,1,
  -1,-1,-1, 0,-1,0,0,0, 1,-1, 1,0,-1,0,1,1,-1,-1,1,0,-1,0,0,1
]);

const VS = `
attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_uv;
uniform mat4 u_mvp;
uniform mat4 u_model;
varying vec3 v_normal;
varying vec2 v_uv;
void main(){
  gl_Position = u_mvp * vec4(a_position,1.0);
  v_normal = mat3(u_model) * a_normal;
  v_uv = a_uv;
}
`;

const FS = `
precision mediump float;
varying vec3 v_normal;
varying vec2 v_uv;
uniform vec3 u_color;
uniform sampler2D u_tex;
uniform float u_useTex;
uniform float u_emissive;
void main(){
  vec3 n = normalize(v_normal);
  vec3 lightDir = normalize(vec3(-0.45,0.85,0.35));
  float diffuse = max(dot(n,lightDir),0.0);
  float light = 0.28 + diffuse * 0.72;
  vec4 tex = texture2D(u_tex, vec2(v_uv.x, 1.0 - v_uv.y));
  vec3 base = mix(u_color, tex.rgb, u_useTex);
  vec3 lit = mix(base * light, base, u_emissive);
  gl_FragColor = vec4(lit,1.0);
}
`;

function identity(): Mat4 {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function multiply(a: Mat4,b: Mat4): Mat4 {
  const o=new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
  return o;
}
function perspective(fov:number,aspect:number,near:number,far:number): Mat4 {
  const f=1/Math.tan(fov/2), nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}
function normalize(v:Vec3):Vec3 { const l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; }
function cross(a:Vec3,b:Vec3):Vec3 { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function subtract(a:Vec3,b:Vec3):Vec3 { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
function lookAt(eye:Vec3,target:Vec3,up:Vec3=[0,1,0]):Mat4 {
  const z=normalize(subtract(eye,target)), x=normalize(cross(up,z)), y=cross(z,x);
  return new Float32Array([
    x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]),
    -(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]),
    -(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]),1
  ]);
}
function model(position:Vec3,scale:Vec3,ry=0):Mat4 {
  const c=Math.cos(ry),s=Math.sin(ry);
  return new Float32Array([
    c*scale[0],0,-s*scale[0],0,
    0,scale[1],0,0,
    s*scale[2],0,c*scale[2],0,
    position[0],position[1],position[2],1
  ]);
}
function lerp(a:number,b:number,t:number){ return a+(b-a)*t; }
function lerp3(a:Vec3,b:Vec3,t:number):Vec3 { return [lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)]; }

function createTextCanvas(width:number,height:number,draw:(ctx:CanvasRenderingContext2D)=>void){
  const canvas=document.createElement("canvas"); canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext("2d"); if(ctx) draw(ctx); return canvas;
}
function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,max:number,line:number,maxLines:number){
  const words=text.split(/\s+/); let current="", row=0;
  for(const word of words){
    const test=current?current+" "+word:word;
    if(ctx.measureText(test).width>max && current){ ctx.fillText(current,x,y+row*line); row++; current=word; if(row>=maxLines-1) break; } else current=test;
  }
  if(row<maxLines) ctx.fillText(current,x,y+row*line);
}
function createPhoneCanvas(analysis:Analysis,mode:"challenge"|"verdict"){
  return createTextCanvas(560,1120,(ctx)=>{
    ctx.fillStyle="#081014";ctx.fillRect(0,0,560,1120);
    const g=ctx.createLinearGradient(0,0,560,1120);g.addColorStop(0,"rgba(55,130,142,.18)");g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(0,0,560,1120);
    ctx.fillStyle="#93d5da";ctx.font="700 24px Arial";ctx.fillText("POCKET BULLSEYE",38,62);
    ctx.fillStyle="#6f8589";ctx.font="18px Arial";ctx.fillText(analysis.instrument+"  ·  "+analysis.timeframe,38,96);
    if(mode==="challenge"){
      ctx.fillStyle="#d5e4e5";ctx.font="700 25px Arial";ctx.fillText("WHAT DID I MISS?",38,182);
      const challenge=analysis.whatYouMayBeMissing[0]||analysis.contradictions[0]||analysis.riskFlags[0]||analysis.traderTrap||"The setup still needs proof.";
      ctx.fillStyle="#ffffff";ctx.font="700 42px Arial";wrap(ctx,challenge,38,250,480,52,5);
      ctx.strokeStyle="#244a50";ctx.beginPath();ctx.moveTo(38,540);ctx.lineTo(522,540);ctx.stroke();
      ctx.fillStyle="#7ed3ae";ctx.font="700 20px Arial";ctx.fillText("BULL CASE",38,595);
      ctx.fillStyle="#cbd6d7";ctx.font="24px Arial";wrap(ctx,analysis.bullishCase,38,640,480,34,5);
      ctx.fillStyle="#e58f8f";ctx.font="700 20px Arial";ctx.fillText("BEAR CASE",38,840);
      ctx.fillStyle="#cbd6d7";ctx.font="24px Arial";wrap(ctx,analysis.bearishCase,38,885,480,34,5);
    } else {
      ctx.fillStyle="#8ebcc0";ctx.font="700 22px Arial";ctx.fillText("BULLSEYE VERDICT",38,180);
      ctx.fillStyle="#ffffff";ctx.font="700 72px Arial";ctx.fillText(analysis.verdict.replaceAll("_"," "),38,285);
      ctx.fillStyle="#d8e0e1";ctx.font="700 30px Arial";wrap(ctx,analysis.verdictHeadline,38,360,480,40,3);
      ctx.fillStyle="#9cb0b2";ctx.font="24px Arial";wrap(ctx,analysis.summary,38,510,480,36,5);
      ctx.fillStyle="#8ed4d9";ctx.font="700 20px Arial";ctx.fillText("READ",38,810);
      ctx.fillStyle="#ffffff";ctx.font="700 34px Arial";ctx.fillText(analysis.direction,38,855);
      ctx.fillStyle="#8ed4d9";ctx.font="700 20px Arial";ctx.fillText("GRADE",230,810);
      ctx.fillStyle="#ffffff";ctx.font="700 34px Arial";ctx.fillText(analysis.setupScore.grade,230,855);
      ctx.fillStyle="#8ed4d9";ctx.font="700 20px Arial";ctx.fillText("SCORE",360,810);
      ctx.fillStyle="#ffffff";ctx.font="700 34px Arial";ctx.fillText(analysis.setupScore.overall+"/100",360,855);
      ctx.strokeStyle="#244a50";ctx.strokeRect(38,944,484,90);ctx.fillStyle="#dff5f6";ctx.font="700 22px Arial";ctx.fillText("OPEN FULL EVIDENCE",145,999);
    }
  });
}
async function createChartCanvas(source:string,analysis:Analysis){
  const canvas=document.createElement("canvas"); canvas.width=1400;canvas.height=820;
  const ctx=canvas.getContext("2d"); if(!ctx) return canvas;
  ctx.fillStyle="#05090b";ctx.fillRect(0,0,canvas.width,canvas.height);
  const img=new Image();
  await new Promise<void>((resolve)=>{img.onload=()=>resolve();img.onerror=()=>resolve();img.src=source;});
  if(img.naturalWidth){
    const scale=Math.min(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight);
    const w=img.naturalWidth*scale,h=img.naturalHeight*scale;
    ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  }
  ctx.fillStyle="rgba(2,6,8,.13)";ctx.fillRect(0,0,canvas.width,canvas.height);
  const structural=analysis.levels.filter(l=>["support","resistance","pivot"].includes(l.kind)&&Number.isFinite(l.y)).slice(0,6);
  for(const level of structural){
    const y=Math.max(24,Math.min(canvas.height-24,(level.y/100)*canvas.height));
    ctx.strokeStyle=level.kind==="support"?"rgba(96,224,154,.9)":level.kind==="resistance"?"rgba(242,116,116,.9)":"rgba(225,225,225,.72)";
    ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(canvas.width-34,y);ctx.stroke();
    ctx.fillStyle="rgba(4,8,10,.82)";ctx.fillRect(canvas.width-270,y-18,232,36);
    ctx.fillStyle="#eef6f6";ctx.font="700 18px Arial";ctx.fillText(level.kind.toUpperCase()+"  "+level.price,canvas.width-256,y+7);
  }
  ctx.fillStyle="rgba(4,8,10,.82)";ctx.fillRect(34,28,510,80);
  ctx.fillStyle="#8ed6db";ctx.font="700 18px Arial";ctx.fillText("POCKET BULLSEYE · VERIFIED VIEW",54,60);
  ctx.fillStyle="#ffffff";ctx.font="700 26px Arial";ctx.fillText(analysis.instrument+" · "+analysis.timeframe,54,94);
  return canvas;
}

export default function PocketVrSimulation({analysis,sourceImage,viewerName,intention,onOpenReport,onShare}:Props){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const monitorHotspot=useRef<HTMLButtonElement|null>(null);
  const phoneHotspot=useRef<HTMLButtonElement|null>(null);
  const stateRef=useRef({focus:"room" as "room"|"monitor"|"phone",phoneMode:"challenge" as "challenge"|"verdict",yaw:0,pitch:-0.04,targetYaw:0,targetPitch:-0.04,dragging:false,lastX:0,lastY:0,moved:0});
  const [focus,setFocus]=useState<"room"|"monitor"|"phone">("room");
  const [phoneMode,setPhoneMode]=useState<"challenge"|"verdict">("challenge");
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{stateRef.current.focus=focus;},[focus]);
  useEffect(()=>{stateRef.current.phoneMode=phoneMode;},[phoneMode]);

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const context=canvas.getContext("webgl",{antialias:true,alpha:false});
    if(!context){setError("This device could not start the 3D renderer.");return;}
    const gl: WebGLRenderingContext = context;
    let frame=0,dead=false,chartTexture:WebGLTexture|null=null,phoneChallenge:WebGLTexture|null=null,phoneVerdict:WebGLTexture|null=null;

    function shader(type:number,source:string){const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||"Shader error");return s;}
    let program:WebGLProgram;
    try{program=gl.createProgram()!;gl.attachShader(program,shader(gl.VERTEX_SHADER,VS));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||"Link error");}
    catch(e){setError(e instanceof Error?e.message:"3D renderer failed.");return;}

    const buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,CUBE,gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,"a_position"),norm=gl.getAttribLocation(program,"a_normal"),uv=gl.getAttribLocation(program,"a_uv");
    const mvpLoc=gl.getUniformLocation(program,"u_mvp"),modelLoc=gl.getUniformLocation(program,"u_model"),colorLoc=gl.getUniformLocation(program,"u_color"),useTexLoc=gl.getUniformLocation(program,"u_useTex"),emissiveLoc=gl.getUniformLocation(program,"u_emissive");
    gl.useProgram(program);gl.enableVertexAttribArray(pos);gl.enableVertexAttribArray(norm);gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(pos,3,gl.FLOAT,false,32,0);gl.vertexAttribPointer(norm,3,gl.FLOAT,false,32,12);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,32,24);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);

    function textureFromCanvas(c:HTMLCanvasElement){
      const t=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,0);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);return t;
    }

    Promise.all([createChartCanvas(sourceImage,analysis)]).then(([chart])=>{
      if(dead)return;
      chartTexture=textureFromCanvas(chart);phoneChallenge=textureFromCanvas(createPhoneCanvas(analysis,"challenge"));phoneVerdict=textureFromCanvas(createPhoneCanvas(analysis,"verdict"));setReady(true);
    }).catch(()=>setError("Could not prepare the virtual screens."));

    const draw=(vp:Mat4,p:Vec3,s:Vec3,color:Vec3,ry=0,tex:WebGLTexture|null=null,emissive=0)=>{
      const mdl=model(p,s,ry),mvp=multiply(vp,mdl);gl.uniformMatrix4fv(mvpLoc,false,mvp);gl.uniformMatrix4fv(modelLoc,false,mdl);gl.uniform3fv(colorLoc,color);gl.uniform1f(useTexLoc,tex?1:0);gl.uniform1f(emissiveLoc,emissive);if(tex){gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);}gl.drawArrays(gl.TRIANGLES,0,36);
    };

    const project=(vp:Mat4,p:Vec3)=>{
      const x=p[0],y=p[1],z=p[2];
      const cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
      if(cw<=0.01)return null;
      return {x:(cx/cw*.5+.5)*canvas.clientWidth,y:(1-(cy/cw*.5+.5))*canvas.clientHeight};
    };

    const targetFor=(which:"room"|"monitor"|"phone")=>{
      if(which==="monitor")return {eye:[0.08,1.55,1.75] as Vec3,target:[0.05,1.55,-0.28] as Vec3};
      if(which==="phone")return {eye:[1.05,1.34,1.25] as Vec3,target:[1.08,1.08,-0.18] as Vec3};
      const s=stateRef.current, dir:[number,number,number]=[Math.sin(s.yaw)*Math.cos(s.pitch),Math.sin(s.pitch),-Math.cos(s.yaw)*Math.cos(s.pitch)];
      return {eye:[0,1.62,3.25] as Vec3,target:[dir[0]*3,1.62+dir[1]*3,3.25+dir[2]*3] as Vec3};
    };

    let eye:[number,number,number]=[0,1.62,3.25],target:[number,number,number]=[0,1.45,0];
    const render=()=>{
      if(dead)return;
      const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(1,Math.floor(canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clearColor(.018,.024,.027,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const s=stateRef.current;s.yaw=lerp(s.yaw,s.targetYaw,.12);s.pitch=lerp(s.pitch,s.targetPitch,.12);
      const desired=targetFor(s.focus);eye=lerp3(eye,desired.eye,.08);target=lerp3(target,desired.target,.08);
      const proj=perspective(Math.PI/3,w/h,.05,100),view=lookAt(eye,target),vp=multiply(proj,view);

      // room shell
      draw(vp,[0,-.12,0],[4.9,.1,5.4],[.12,.105,.09]);
      draw(vp,[0,2.55,-2.75],[4.9,2.7,.08],[.085,.095,.10]);
      draw(vp,[-4.7,2.4,0],[.08,2.6,5.2],[.075,.083,.087]);
      draw(vp,[4.7,2.4,0],[.08,2.6,5.2],[.07,.078,.082]);
      draw(vp,[0,5.0,0],[4.9,.06,5.4],[.095,.098,.096]);

      // desk
      draw(vp,[0,.78,-.05],[2.65,.12,1.05],[.22,.16,.105]);
      draw(vp,[-2.15,.35,-.48],[.11,.46,.11],[.10,.085,.07]);
      draw(vp,[ 2.15,.35,-.48],[.11,.46,.11],[.10,.085,.07]);
      draw(vp,[-2.15,.35,.38],[.11,.46,.11],[.10,.085,.07]);
      draw(vp,[ 2.15,.35,.38],[.11,.46,.11],[.10,.085,.07]);

      // monitor + stand
      draw(vp,[0,1.55,-.38],[1.46,.88,.08],[.035,.04,.043]);
      draw(vp,[0,1.55,-.285],[1.34,.76,.018],[1,1,1],0,chartTexture,1);
      draw(vp,[0,1.02,-.38],[.10,.46,.08],[.09,.095,.098]);
      draw(vp,[0,.87,-.22],[.42,.06,.30],[.10,.105,.108]);

      // phone on angled stand
      draw(vp,[1.18,1.03,.08],[.36,.70,.055],[.028,.032,.034],-.18);
      draw(vp,[1.17,1.03,.137],[.315,.64,.014],[1,1,1],-.18,stateRef.current.phoneMode==="verdict"?phoneVerdict:phoneChallenge,1);

      // keyboard / mouse
      draw(vp,[-.18,.93,.48],[.82,.035,.26],[.075,.078,.08]);
      draw(vp,[1.08,.92,.54],[.17,.045,.24],[.09,.095,.098]);

      // mug
      draw(vp,[-1.65,1.03,.32],[.28,.34,.28],[.38,.34,.30]);
      draw(vp,[-1.65,1.38,.32],[.20,.015,.20],[.11,.07,.045]);

      // ambient lamp
      draw(vp,[2.45,1.56,-1.35],[.14,.78,.14],[.13,.11,.09]);
      draw(vp,[2.45,2.42,-1.35],[.42,.16,.42],[.62,.50,.30],0,null,.25);

      const mh=project(vp,[0,1.55,-.2]),ph=project(vp,[1.17,1.04,.17]);
      if(monitorHotspot.current){monitorHotspot.current.hidden=!mh||s.focus!=="room";if(mh){monitorHotspot.current.style.left=mh.x+"px";monitorHotspot.current.style.top=mh.y+"px";}}
      if(phoneHotspot.current){phoneHotspot.current.hidden=!ph||s.focus!=="room";if(ph){phoneHotspot.current.style.left=ph.x+"px";phoneHotspot.current.style.top=ph.y+"px";}}

      frame=requestAnimationFrame(render);
    };render();

    return()=>{dead=true;cancelAnimationFrame(frame);[chartTexture,phoneChallenge,phoneVerdict].forEach(t=>t&&gl.deleteTexture(t));gl.deleteBuffer(buffer);gl.deleteProgram(program);};
  },[analysis,sourceImage]);

  const pointerDown=(e:React.PointerEvent<HTMLCanvasElement>)=>{const s=stateRef.current;s.dragging=true;s.lastX=e.clientX;s.lastY=e.clientY;s.moved=0;e.currentTarget.setPointerCapture(e.pointerId);};
  const pointerMove=(e:React.PointerEvent<HTMLCanvasElement>)=>{const s=stateRef.current;if(!s.dragging||s.focus!=="room")return;const dx=e.clientX-s.lastX,dy=e.clientY-s.lastY;s.lastX=e.clientX;s.lastY=e.clientY;s.moved+=Math.abs(dx)+Math.abs(dy);s.targetYaw=Math.max(-1.0,Math.min(1.0,s.targetYaw-dx*.0045));s.targetPitch=Math.max(-.42,Math.min(.32,s.targetPitch-dy*.004));};
  const pointerUp=()=>{stateRef.current.dragging=false;};

  const go=(next:"room"|"monitor"|"phone")=>{setFocus(next);stateRef.current.focus=next;};
  const showVerdict=()=>{setPhoneMode("verdict");stateRef.current.phoneMode="verdict";};

  return <section className="vrPocket" data-focus={focus} data-phone={phoneMode}>
    <canvas ref={canvasRef} className="vrCanvas" aria-label="Interactive 3D Pocket Bullseye trading room" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/>
    <header className="vrHud"><div><span>POCKET BULLSEYE · VR PROTOTYPE</span><small>{viewerName?viewerName.toUpperCase()+" · ":""}{analysis.instrument} · {analysis.timeframe} · {intention==="UNSURE"?"OPEN READ":intention}</small></div><b>{ready?"3D ROOM READY":"PREPARING ROOM…"}</b></header>

    <button ref={monitorHotspot} className="vrHotspot" type="button" onClick={()=>go("monitor")}><i/>LOOK AT MONITOR</button>
    <button ref={phoneHotspot} className="vrHotspot" type="button" onClick={()=>{setPhoneMode("challenge");go("phone");}}><i/>PICK UP PHONE</button>

    {focus==="room"?<div className="vrGuide"><small>FIRST-PERSON ROOM</small><strong>Drag to look around.</strong><p>Tap the monitor to inspect the chart or the phone to ask Pocket what you may have missed.</p></div>:null}

    {focus==="monitor"?<div className="vrFocusPanel"><small>VIRTUAL MONITOR · LIVE POCKET DATA</small><strong>{analysis.marketStructure}</strong><p>{analysis.levelStory}</p><div><button type="button" onClick={()=>go("room")}>← BACK TO ROOM</button><button type="button" onClick={()=>{setPhoneMode("challenge");go("phone");}}>CHECK POCKET →</button></div></div>:null}

    {focus==="phone"?<div className="vrFocusPanel vrPhonePanel"><small>VIRTUAL PHONE · POCKET BULLSEYE</small><strong>{phoneMode==="challenge"?"What did I miss?":analysis.verdict.replaceAll("_"," ")}</strong><p>{phoneMode==="challenge"?(analysis.whatYouMayBeMissing[0]||analysis.contradictions[0]||analysis.riskFlags[0]||analysis.traderTrap):analysis.verdictHeadline}</p><div><button type="button" onClick={()=>go("room")}>← PUT PHONE DOWN</button>{phoneMode==="challenge"?<button type="button" onClick={showVerdict}>SHOW VERDICT →</button>:<><button type="button" onClick={()=>onOpenReport()}>FULL EVIDENCE</button><button type="button" onClick={onShare}>SHARE</button></>}</div></div>:null}

    {error?<div className="vrError">{error}</div>:null}
    <footer className="vrFooter"><span>REAL-TIME 3D SCENE · REAL POCKET ANALYSIS</span><small>Prototype environment. Decision support only — not a trade instruction.</small></footer>
  </section>;
}

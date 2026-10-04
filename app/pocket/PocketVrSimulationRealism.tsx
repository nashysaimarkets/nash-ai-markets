"use client";

import { useEffect, useRef, useState } from "react";
import PocketVrSimulation from "./PocketVrSimulation";

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

declare global {
  interface Window {
    THREE?: any;
  }
}

const THREE_SRC = "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js";
const GLTF_SRC = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
const OFFICE_GLB = "https://cdn.3dassets.dev/assets/17066/v1/model.glb";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="' + src + '"]');
    if (existing) {
      if (existing.dataset.ready === "1") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Failed to load " + src)), { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => { script.dataset.ready = "1"; resolve(); }, { once: true });
    script.addEventListener("error", () => reject(new Error("Failed to load " + src)), { once: true });
    document.head.appendChild(script);
  });
}

function textCanvas(width:number,height:number,draw:(ctx:CanvasRenderingContext2D)=>void) {
  const c=document.createElement("canvas"); c.width=width; c.height=height;
  const ctx=c.getContext("2d"); if(ctx) draw(ctx); return c;
}
function wrap(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,maxWidth:number,lineHeight:number,maxLines:number) {
  const words=(text||"").split(/\s+/); let line="", row=0;
  for(const word of words){
    const test=line?line+" "+word:word;
    if(ctx.measureText(test).width>maxWidth && line){
      ctx.fillText(line,x,y+row*lineHeight); row++; line=word;
      if(row>=maxLines-1) break;
    } else line=test;
  }
  if(row<maxLines && line) ctx.fillText(line,x,y+row*lineHeight);
}
async function buildChartCanvas(source:string,analysis:Analysis) {
  const c=document.createElement("canvas"); c.width=1400; c.height=820;
  const ctx=c.getContext("2d"); if(!ctx) return c;
  ctx.fillStyle="#05090b"; ctx.fillRect(0,0,c.width,c.height);
  const img=new Image();
  await new Promise<void>((resolve)=>{ img.onload=()=>resolve(); img.onerror=()=>resolve(); img.src=source; });
  if(img.naturalWidth){
    const s=Math.min(c.width/img.naturalWidth,c.height/img.naturalHeight);
    const w=img.naturalWidth*s,h=img.naturalHeight*s;
    ctx.drawImage(img,(c.width-w)/2,(c.height-h)/2,w,h);
  }
  for(const level of analysis.levels.filter(l=>["support","resistance","pivot"].includes(l.kind)&&Number.isFinite(l.y)).slice(0,6)){
    const y=Math.max(24,Math.min(c.height-24,(level.y/100)*c.height));
    ctx.strokeStyle=level.kind==="support"?"#55d98b":level.kind==="resistance"?"#e96d6d":"#d9e1e2";
    ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(28,y); ctx.lineTo(c.width-28,y); ctx.stroke();
    ctx.fillStyle="rgba(5,8,10,.84)"; ctx.fillRect(c.width-290,y-20,250,40);
    ctx.fillStyle="#f2f7f7"; ctx.font="700 19px Arial"; ctx.fillText(level.kind.toUpperCase()+"  "+level.price,c.width-275,y+7);
  }
  ctx.fillStyle="rgba(4,8,10,.8)"; ctx.fillRect(30,26,520,82);
  ctx.fillStyle="#8fd9de"; ctx.font="700 18px Arial"; ctx.fillText("POCKET BULLSEYE · VERIFIED VIEW",50,58);
  ctx.fillStyle="#ffffff"; ctx.font="700 28px Arial"; ctx.fillText(analysis.instrument+" · "+analysis.timeframe,50,95);
  return c;
}
function buildPhoneCanvas(analysis:Analysis, mode:"challenge"|"verdict") {
  return textCanvas(620,1240,(ctx)=>{
    ctx.fillStyle="#081014";ctx.fillRect(0,0,620,1240);
    const g=ctx.createLinearGradient(0,0,620,1240);g.addColorStop(0,"rgba(48,130,142,.22)");g.addColorStop(1,"rgba(0,0,0,0)");ctx.fillStyle=g;ctx.fillRect(0,0,620,1240);
    ctx.fillStyle="#93d5da";ctx.font="700 26px Arial";ctx.fillText("POCKET BULLSEYE",42,68);
    ctx.fillStyle="#6f8589";ctx.font="19px Arial";ctx.fillText(analysis.instrument+" · "+analysis.timeframe,42,108);
    if(mode==="challenge"){
      const challenge=analysis.whatYouMayBeMissing[0]||analysis.contradictions[0]||analysis.riskFlags[0]||analysis.traderTrap||"The setup still needs proof.";
      ctx.fillStyle="#dce9ea";ctx.font="700 24px Arial";ctx.fillText("WHAT DID I MISS?",42,188);
      ctx.fillStyle="#fff";ctx.font="700 45px Arial";wrap(ctx,challenge,42,260,530,56,5);
      ctx.fillStyle="#7ed3ae";ctx.font="700 20px Arial";ctx.fillText("BULL CASE",42,650);
      ctx.fillStyle="#cbd6d7";ctx.font="24px Arial";wrap(ctx,analysis.bullishCase,42,696,530,34,5);
      ctx.fillStyle="#e58f8f";ctx.font="700 20px Arial";ctx.fillText("BEAR CASE",42,930);
      ctx.fillStyle="#cbd6d7";ctx.font="24px Arial";wrap(ctx,analysis.bearishCase,42,976,530,34,5);
    } else {
      ctx.fillStyle="#8ebcc0";ctx.font="700 22px Arial";ctx.fillText("BULLSEYE VERDICT",42,190);
      ctx.fillStyle="#fff";ctx.font="700 78px Arial";ctx.fillText(analysis.verdict.replaceAll("_"," "),42,310);
      ctx.fillStyle="#e5ecec";ctx.font="700 32px Arial";wrap(ctx,analysis.verdictHeadline,42,390,530,42,3);
      ctx.fillStyle="#aebec0";ctx.font="24px Arial";wrap(ctx,analysis.summary,42,560,530,36,5);
      ctx.fillStyle="#8ed4d9";ctx.font="700 20px Arial";ctx.fillText("READ",42,930);
      ctx.fillStyle="#fff";ctx.font="700 34px Arial";ctx.fillText(analysis.direction,42,976);
      ctx.fillStyle="#8ed4d9";ctx.font="700 20px Arial";ctx.fillText("GRADE",270,930);
      ctx.fillStyle="#fff";ctx.font="700 34px Arial";ctx.fillText(analysis.setupScore.grade,270,976);
      ctx.fillStyle="#8ed4d9";ctx.font="700 20px Arial";ctx.fillText("SCORE",420,930);
      ctx.fillStyle="#fff";ctx.font="700 34px Arial";ctx.fillText(analysis.setupScore.overall+"/100",420,976);
    }
  });
}

export default function PocketVrSimulationRealism(props:Props) {
  const {analysis,sourceImage,viewerName,intention,onOpenReport,onShare}=props;
  const mountRef=useRef<HTMLDivElement|null>(null);
  const sceneRef=useRef<any>(null);
  const [ready,setReady]=useState(false);
  const [fallback,setFallback]=useState(false);
  const [focus,setFocus]=useState<"room"|"monitor"|"phone">("room");
  const [phoneMode,setPhoneMode]=useState<"challenge"|"verdict">("challenge");

  useEffect(()=>{
    let disposed=false;
    let renderer:any, animation=0, resize:ResizeObserver|undefined;
    (async()=>{
      try{
        await loadScript(THREE_SRC);
        await loadScript(GLTF_SRC);
        if(disposed||!mountRef.current||!window.THREE) return;
        const THREE=window.THREE;
        const scene=new THREE.Scene();
        scene.background=new THREE.Color(0x0b0d0f);
        scene.fog=new THREE.FogExp2(0x0b0d0f,0.022);
        const camera=new THREE.PerspectiveCamera(58,1,0.05,100);
        camera.position.set(0,1.6,3.15);
        const rendererLocal=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
        rendererLocal.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
        rendererLocal.outputEncoding=THREE.sRGBEncoding;
        rendererLocal.shadowMap.enabled=true;
        rendererLocal.shadowMap.type=THREE.PCFSoftShadowMap;
        renderer=rendererLocal;
        mountRef.current.replaceChildren(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xbfd7e2,0x31271f,1.2));
        const warm=new THREE.PointLight(0xffc98f,1.5,8);warm.position.set(2.4,2.5,1.1);warm.castShadow=true;scene.add(warm);
        const cool=new THREE.PointLight(0x6ac7d2,.9,7);cool.position.set(-1.8,1.9,-.4);scene.add(cool);

        const loader=new THREE.GLTFLoader();
        loader.load(OFFICE_GLB,(gltf:any)=>{
          if(disposed)return;
          const office=gltf.scene;
          office.position.set(0,0,-1.4);
          office.rotation.y=Math.PI;
          office.traverse((obj:any)=>{if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;}});
          scene.add(office);
        },undefined,()=>{});

        const desk=new THREE.Mesh(new THREE.BoxGeometry(2.35,.09,.86),new THREE.MeshStandardMaterial({color:0x5a4331,roughness:.72}));
        desk.position.set(0,.74,.22);desk.castShadow=true;desk.receiveShadow=true;scene.add(desk);

        const chartCanvas=await buildChartCanvas(sourceImage,analysis);
        const chartTex=new THREE.CanvasTexture(chartCanvas);chartTex.encoding=THREE.sRGBEncoding;
        const monitorGroup=new THREE.Group();
        const monitorBody=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.12,.08),new THREE.MeshStandardMaterial({color:0x101416,metalness:.45,roughness:.3}));
        const monitorScreen=new THREE.Mesh(new THREE.PlaneGeometry(1.72,.94),new THREE.MeshBasicMaterial({map:chartTex,toneMapped:false}));
        monitorScreen.position.z=.046;monitorScreen.name="monitor-screen";
        monitorGroup.add(monitorBody,monitorScreen);
        monitorGroup.position.set(-.15,1.46,-.30);scene.add(monitorGroup);
        const stand=new THREE.Mesh(new THREE.BoxGeometry(.09,.46,.09),new THREE.MeshStandardMaterial({color:0x34383a,metalness:.55,roughness:.32}));stand.position.set(-.15,.96,-.30);scene.add(stand);

        const phoneChallengeTex=new THREE.CanvasTexture(buildPhoneCanvas(analysis,"challenge"));phoneChallengeTex.encoding=THREE.sRGBEncoding;
        const phoneVerdictTex=new THREE.CanvasTexture(buildPhoneCanvas(analysis,"verdict"));phoneVerdictTex.encoding=THREE.sRGBEncoding;
        const phoneGroup=new THREE.Group();
        const phoneBody=new THREE.Mesh(new THREE.BoxGeometry(.47,.88,.045),new THREE.MeshStandardMaterial({color:0x111416,metalness:.55,roughness:.22}));
        const phoneScreen=new THREE.Mesh(new THREE.PlaneGeometry(.415,.78),new THREE.MeshBasicMaterial({map:phoneChallengeTex,toneMapped:false}));
        phoneScreen.position.z=.026;phoneScreen.name="phone-screen";phoneGroup.add(phoneBody,phoneScreen);phoneGroup.position.set(1.02,1.07,.30);phoneGroup.rotation.y=-.25;scene.add(phoneGroup);

        const mug=new THREE.Mesh(new THREE.CylinderGeometry(.18,.16,.32,32),new THREE.MeshStandardMaterial({color:0xd6d0c5,roughness:.7}));mug.position.set(-1.15,.95,.38);mug.castShadow=true;scene.add(mug);
        const coffee=new THREE.Mesh(new THREE.CircleGeometry(.145,32),new THREE.MeshStandardMaterial({color:0x2b160d,roughness:.6}));coffee.rotation.x=-Math.PI/2;coffee.position.set(-1.15,1.115,.38);scene.add(coffee);

        const floor=new THREE.Mesh(new THREE.PlaneGeometry(18,18),new THREE.MeshStandardMaterial({color:0x202326,roughness:1}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);

        const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
        let yaw=0,pitch=-.05,drag=false,moved=0,lastX=0,lastY=0;
        let desiredPos=new THREE.Vector3(0,1.6,3.15),desiredTarget=new THREE.Vector3(0,1.42,-.2),currentTarget=desiredTarget.clone();

        const setSceneFocus=(next:"room"|"monitor"|"phone")=>{
          setFocus(next);
          if(next==="monitor"){desiredPos.set(-.15,1.48,1.05);desiredTarget.set(-.15,1.45,-.30);}
          else if(next==="phone"){desiredPos.set(.95,1.27,1.35);desiredTarget.set(1.02,1.08,.30);}
          else {desiredPos.set(0,1.6,3.15);}
        };
        sceneRef.current={setSceneFocus,setPhoneMode:(mode:"challenge"|"verdict")=>{
          setPhoneMode(mode);(phoneScreen.material as any).map=mode==="verdict"?phoneVerdictTex:phoneChallengeTex;(phoneScreen.material as any).needsUpdate=true;
        }};

        const canvas=renderer.domElement;
        canvas.style.width="100%";canvas.style.height="100%";canvas.style.display="block";canvas.style.touchAction="none";
        canvas.addEventListener("pointerdown",(e:any)=>{drag=true;moved=0;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId);});
        canvas.addEventListener("pointermove",(e:any)=>{if(!drag||focus!=="room")return;const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;moved+=Math.abs(dx)+Math.abs(dy);yaw=Math.max(-1.2,Math.min(1.2,yaw-dx*.004));pitch=Math.max(-.42,Math.min(.34,pitch-dy*.004));});
        canvas.addEventListener("pointerup",(e:any)=>{
          drag=false;
          if(moved>12)return;
          const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;raycaster.setFromCamera(pointer,camera);
          const hit=raycaster.intersectObjects([monitorScreen,phoneScreen],false)[0];
          if(hit?.object===monitorScreen)setSceneFocus("monitor");
          if(hit?.object===phoneScreen)setSceneFocus("phone");
        });

        const fit=()=>{const el=mountRef.current;if(!el)return;const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};
        resize=new ResizeObserver(fit);resize.observe(mountRef.current);fit();

        const clock=new THREE.Clock();
        const tick=()=>{
          if(disposed)return;
          const t=clock.getElapsedTime();
          if(focus==="room"){
            desiredTarget.set(Math.sin(yaw)*3,1.55+Math.sin(pitch)*2.2,3.15-Math.cos(yaw)*3);
          }
          camera.position.lerp(desiredPos,.075);
          currentTarget.lerp(desiredTarget,.09);
          camera.lookAt(currentTarget);
          warm.intensity=1.45+Math.sin(t*.7)*.06;
          renderer.render(scene,camera);
          animation=requestAnimationFrame(tick);
        };
        tick();setReady(true);
      }catch{
        if(!disposed)setFallback(true);
      }
    })();
    return()=>{disposed=true;cancelAnimationFrame(animation);resize?.disconnect();renderer?.dispose?.();sceneRef.current=null;};
  },[analysis,sourceImage]);

  if(fallback) return <PocketVrSimulation {...props}/>;

  const go=(next:"room"|"monitor"|"phone")=>sceneRef.current?.setSceneFocus(next);
  const verdict=()=>sceneRef.current?.setPhoneMode("verdict");

  return <section className="vr5">
    <div ref={mountRef} className="vr5World" aria-label="Interactive realistic 3D Pocket Bullseye trading environment"/>
    <header className="vr5Hud"><div><span>POCKET BULLSEYE · IMMERSIVE MODE</span><small>{viewerName?viewerName.toUpperCase()+" · ":""}{analysis.instrument} · {analysis.timeframe} · {intention==="UNSURE"?"OPEN READ":intention}</small></div><b>{ready?"ROOM READY":"BUILDING ROOM…"}</b></header>
    {focus==="room"?<div className="vr5Guide"><small>FIRST-PERSON SIMULATION</small><strong>Drag to look around.</strong><p>Tap the monitor to inspect your chart. Tap the phone to ask Pocket what you may have missed.</p></div>:null}
    {focus==="monitor"?<div className="vr5Panel"><small>YOUR CHART · INSIDE THE ROOM</small><strong>{analysis.marketStructure}</strong><p>{analysis.levelStory}</p><div><button type="button" onClick={()=>go("room")}>← BACK TO ROOM</button><button type="button" onClick={()=>go("phone")}>CHECK POCKET →</button></div></div>:null}
    {focus==="phone"?<div className="vr5Panel vr5Right"><small>POCKET · IN YOUR HAND</small><strong>{phoneMode==="challenge"?"What did I miss?":analysis.verdict.replaceAll("_"," ")}</strong><p>{phoneMode==="challenge"?(analysis.whatYouMayBeMissing[0]||analysis.contradictions[0]||analysis.riskFlags[0]||analysis.traderTrap):analysis.verdictHeadline}</p><div><button type="button" onClick={()=>go("room")}>← PUT PHONE DOWN</button>{phoneMode==="challenge"?<button type="button" onClick={verdict}>SHOW VERDICT →</button>:<><button type="button" onClick={()=>onOpenReport()}>FULL EVIDENCE</button><button type="button" onClick={onShare}>SHARE</button></>}</div></div>:null}
    <footer className="vr5Footer">REAL-TIME 3D ENVIRONMENT · REAL POCKET ANALYSIS · NO EXTRA AI CALL PER SCENE</footer>
  </section>;
}

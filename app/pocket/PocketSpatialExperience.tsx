"use client";

import { useEffect, useRef, useState } from "react";

const MOTION_KEY = "pocket-spatial-motion";

/** A decorative 3D star volume. It has no access to the analysis or uploaded images. */
function StarVolume({ enabled, scanning }: { enabled: boolean; scanning: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, powerPreference: "low-power" });
    if (!gl) return;
    const shaders: WebGLShader[] = [];
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vertex = compile(gl.VERTEX_SHADER, `
      attribute vec4 a_star;
      uniform float u_time;
      uniform float u_aspect;
      uniform float u_pixel;
      varying float v_light;
      varying float v_color;
      void main() {
        float z = mod(a_star.z - u_time * 0.12, 22.0) + 2.5;
        float drift = sin(u_time * 0.055) * 0.65;
        vec2 p = vec2(a_star.x + drift, a_star.y + cos(u_time * 0.04) * 0.3) / z * 2.2;
        p.x /= u_aspect;
        gl_Position = vec4(p, 0.0, 1.0);
        gl_PointSize = clamp((15.0 / z + a_star.w * 1.1) * u_pixel, 1.0, 5.0);
        v_light = smoothstep(2.5, 5.0, z) * (0.32 + 0.42 * a_star.w) * (0.8 + 0.2 * sin(u_time * 0.4 + a_star.x));
        v_color = a_star.w;
      }`);
    const fragment = compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying float v_light;
      varying float v_color;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = (1.0 - smoothstep(0.05, 0.5, d)) * v_light;
        gl_FragColor = vec4(mix(vec3(0.3, 0.8, 0.95), vec3(0.9, 0.96, 1.0), v_color), alpha);
      }`);
    const program = gl.createProgram();
    if (!vertex || !fragment || !program) {
      shaders.forEach((shader) => gl.deleteShader(shader));
      if (program) gl.deleteProgram(program);
      return;
    }
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach((shader) => gl.deleteShader(shader)); gl.deleteProgram(program); return;
    }
    gl.useProgram(program);
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const count = mobile ? 240 : 520;
    const stars = new Float32Array(count * 4);
    // Deterministic seed keeps the scene stable between mounts.
    let seed = 1743;
    const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 | 0) >>> 0) / 4294967296;
    for (let i = 0; i < count; i++) stars.set([(random() - .5) * 36, (random() - .5) * 30, random() * 22, random()], i * 4);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, stars, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_star");
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 4, gl.FLOAT, false, 0, 0);
    const time = gl.getUniformLocation(program, "u_time");
    const aspect = gl.getUniformLocation(program, "u_aspect");
    const pixel = gl.getUniformLocation(program, "u_pixel");
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(aspect, canvas.width / Math.max(1, canvas.height));
      gl.uniform1f(pixel, ratio);
    };
    resize(); window.addEventListener("resize", resize, { passive: true });
    let frame = 0; let last = 0; let elapsed = 0; let previous = 0; let lost = false;
    const interval = 1000 / (scanning ? 12 : 24);
    const render = (now: number) => {
      if (lost || document.hidden) return;
      frame = requestAnimationFrame(render);
      if (now - last < interval) return;
      elapsed += previous ? Math.min(100, now - previous) / 1000 : 0;
      previous = now; last = now;
      gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(time, elapsed); gl.drawArrays(gl.POINTS, 0, count);
    };
    const visibility = () => { cancelAnimationFrame(frame); previous = 0; if (!document.hidden && !lost) frame = requestAnimationFrame(render); };
    const contextLost = () => { lost = true; cancelAnimationFrame(frame); };
    document.addEventListener("visibilitychange", visibility);
    canvas.addEventListener("webglcontextlost", contextLost);
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("webglcontextlost", contextLost);
      gl.deleteBuffer(buffer); gl.deleteProgram(program); shaders.forEach((shader) => gl.deleteShader(shader));
      gl.clear(gl.COLOR_BUFFER_BIT);
    };
  }, [enabled, scanning]);
  return <canvas ref={canvasRef} className="psStarVolume" />;
}

export default function PocketSpatialExperience({ scanning = false }: { scanning?: boolean }) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(preference.matches);
      try { setMotion(localStorage.getItem(MOTION_KEY) !== "off"); } catch { setMotion(true); }
    };
    sync(); preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  const enabled = motion && !reduced;
  useEffect(() => {
    const root = backdropRef.current?.closest<HTMLElement>(".psApp");
    if (!root) return;
    const sync = () => { root.dataset.spatialMotion = enabled && !document.hidden ? "on" : "off"; };
    sync(); document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [enabled]);
  const toggleMotion = () => {
    const next = !motion; setMotion(next);
    try { localStorage.setItem(MOTION_KEY, next ? "on" : "off"); } catch {}
  };
  return <>
    <div ref={backdropRef} className="psSpatialBackdrop" aria-hidden="true">
      <div className="psNebula" /><div className="psAtmosphere" />
      <StarVolume enabled={enabled} scanning={scanning} />
      <div className="psSpatialHorizon" /><div className="psSpaceVignette" />
    </div>
    <button type="button" className="psMotionControl" onClick={toggleMotion} aria-pressed={enabled} aria-label={reduced ? "Background motion disabled by your device settings" : enabled ? "Pause background motion" : "Enable background motion"} disabled={reduced}>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{enabled ? <path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/> : <path d="m7 4 9 6-9 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>}</svg>
      <span>MOTION {enabled ? "ON" : "OFF"}</span>
    </button>
  </>;
}

"use client";

/**
 * Le Bureau en 3D : une « machine » sur une plaque métallique. Un tapis roulant en circuit fait passer
 * les dossiers d'offres d'un agent à l'autre. Chaque poste a son agent, son bureau et son accessoire.
 * Une salle de pause (canapé, café) accueille les agents qui se reposent.
 * Tout est procédural (three.js) : aucun modèle, aucune image. Inspiré du gabarit « Agentic Factory ».
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { AGENTS, type AgentId, type AgentState } from "@/lib/data";

export interface Folder { from: AgentId; to: AgentId; start: number; dur: number; red?: boolean }
export interface Sim {
  states: Record<AgentId, AgentState>;
  folders: Folder[];
  pending: number;
  night: boolean;
  confettiAt: number;
}
export type Hit =
  | { kind: "agent"; id: AgentId }
  | { kind: "boss" }
  | { kind: "bannette" }
  | { kind: "cork" }
  | { kind: "white" }
  | { kind: "coffee" };

export type FactoryMode = "assembled" | "stations" | "order" | "lounge";
export type FactoryCamera = "overview" | "side" | "top" | "station" | "flight";
export interface FactoryApi {
  say: (id: AgentId | "boss", text: string, ms?: number) => void;
  setMode: (m: FactoryMode) => void;
  setCamera: (c: FactoryCamera) => void;
  focus: (id: string) => void;
}

const STATE_LABEL: Record<AgentState, string> = {
  working: "Au travail", coffee: "En pause", waiting: "Attend Yacine", error: "En erreur", sleeping: "Endormi",
};

export default function Factory3D({ sim, onHit, apiRef, height = 700 }: {
  sim: MutableRefObject<Sim>;
  onHit: (h: Hit) => void;
  apiRef: MutableRefObject<FactoryApi | null>;
  height?: number | string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef(onHit);
  useEffect(() => { hitRef.current = onHit; }, [onHit]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const dispose = initScene(root, sim, (h) => hitRef.current(h), apiRef);
    return () => { dispose(); apiRef.current = null; };
  }, [sim, apiRef]);

  return (
    <div ref={rootRef} className="f3d" style={{ height }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div id="scene" role="img" aria-label="Le bureau en 3D : dix agents à leur poste le long d'un tapis roulant, avec une salle de pause. Glisse pour tourner, molette pour zoomer, clique sur un agent pour voir son journal." />
      <div className="vignette" />
      <canvas id="confetti" />
      <header className="topbar">
        <div className="identity">
          <div className="mark"><svg width="17" height="17" viewBox="0 0 20 20" fill="none"><path d="M3 5l7 11 7-11M7 5l3 5 3-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
          <div><strong>Le Bureau</strong><small>Équipe d&apos;agents · recherche d&apos;emploi</small></div>
        </div>
        <div className="status" id="status"><i /><span id="status-text">Équipe au travail</span><span id="clock" /></div>
      </header>
      <div className="scene-heading">La chaîne de candidature <span className="index">10 AGENTS / 1 BOSS</span></div>
      <div id="journey">
        <div className="journey-icon"><svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 4h10v9H3zM6 4V2h4v2m-5 4h6" stroke="currentColor" strokeLinejoin="round" /></svg></div>
        <div><strong id="journey-title">Offre repérée</strong><small id="journey-detail" /></div>
        <div className="track"><i id="journey-progress" /></div>
      </div>
      <div id="labels" />
      <div id="bubbles" />
      <div id="tooltip" role="tooltip"><strong /><p /></div>
      <div className="controls">
        <nav className="mode-bar" aria-label="Mode d'affichage">
          <button data-mode="assembled" aria-pressed="true"><svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5l6 3.3v6.4l-6 3.3-6-3.3V4.8L8 1.5zM2 4.8l6 3.4 6-3.4M8 8.2v6.3" stroke="currentColor" strokeLinejoin="round" /></svg>Ensemble</button>
          <button data-mode="stations" aria-pressed="false"><svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5l6 3-6 3-6-3 6-3zM2 8l6 3 6-3M2 11.5l6 3 6-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>Postes</button>
          <button data-mode="order" aria-pressed="false"><svg viewBox="0 0 16 16" fill="none"><path d="M5 2.5l8 5.5-8 5.5v-11z" stroke="currentColor" strokeLinejoin="round" /></svg>Une offre</button>
          <button data-mode="lounge" aria-pressed="false"><svg viewBox="0 0 16 16" fill="none"><path d="M3 6h8v4a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm8 1h1.5a1.5 1.5 0 010 3H11M5 2.5v1.5M8 2v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" /></svg>Pause</button>
        </nav>
        <nav className="camera-row" aria-label="Caméra">
          <span className="caption">VUE</span>
          <button data-camera="overview" aria-pressed="true">Ensemble</button>
          <button data-camera="side" aria-pressed="false">Côté</button>
          <button data-camera="top" aria-pressed="false">Dessus</button>
          <button data-camera="station" aria-pressed="false">Poste</button>
          <button data-camera="flight" aria-pressed="false">Survol</button>
          <span className="divider" />
          <button id="play" aria-label="Mettre en pause l'animation" aria-pressed="false" />
        </nav>
      </div>
      <footer className="footer">
        <span className="wordmark">Données fictives · mode démo</span>
        <span className="hint"><svg width="13" height="16" viewBox="0 0 13 16" fill="none"><rect x="2" y="1" width="9" height="14" rx="4.5" stroke="currentColor" /><path d="M6.5 4v3" stroke="currentColor" strokeLinecap="round" /></svg>Tourne. Zoome. Clique sur un agent.</span>
      </footer>
      <div id="loading"><i /><span>Assemblage du bureau</span></div>
      <div id="error" role="alert"><strong>Impossible de lancer la 3D</strong><p>Vérifie que WebGL est activé dans ton navigateur.</p><button onClick={() => location.reload()}>Réessayer</button></div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

type Vec3 = [number, number, number];
const TAU = Math.PI * 2;
const PLATE_Y = 0.29;

interface Spot { x: number; z: number; sit: boolean; face: number; via: [number, number][] }
const SPOTS: Spot[] = [
  { x: 10.0, z: 4.0, sit: false, face: Math.PI / 2, via: [[10.0, 2.5]] },
  { x: 10.0, z: 5.3, sit: false, face: Math.PI / 2, via: [[9.2, 2.5], [9.2, 5.3]] },
  { x: 6.4, z: 3.95, sit: true, face: 0, via: [[5.0, 2.5], [5.0, 4.9], [6.4, 4.9]] },
  { x: 7.4, z: 3.95, sit: true, face: 0, via: [[5.0, 2.5], [5.0, 4.9], [7.4, 4.9]] },
  { x: 8.4, z: 3.95, sit: true, face: 0, via: [[5.0, 2.5], [5.0, 4.9], [8.4, 4.9]] },
  { x: 5.5, z: 6.6, sit: false, face: 1.1, via: [[5.0, 2.5], [5.0, 6.6]] },
  { x: 6.5, z: 6.9, sit: false, face: -1.1, via: [[5.0, 2.5], [5.0, 7.3], [6.5, 7.3]] },
  { x: 10.3, z: 6.6, sit: false, face: Math.PI / 2, via: [[9.2, 2.5], [9.2, 6.6]] },
  { x: 8.9, z: 6.5, sit: false, face: 0, via: [[9.2, 2.5], [9.2, 6.5]] },
];

const LAYOUT: Record<AgentId, { x: number; z: number; stand?: boolean }> = {
  veilleur: { x: -7.2, z: -4.4 }, verificateur: { x: -3.6, z: -4.4 }, analyste: { x: 0, z: -4.4 },
  enqueteur: { x: 3.6, z: -4.4 }, plume: { x: 7.2, z: -4.4 },
  relecteur: { x: 7.2, z: 0 }, postier: { x: 0, z: 0 }, archiviste: { x: -3.6, z: 0 }, coach: { x: -7.2, z: 0 },
  chef: { x: 5.4, z: 2.7, stand: true },
};
const BOSS_ST = { x: 3.6, z: 0 };

type HairStyle = "short" | "long" | "bun" | "bob" | "wavy" | "bald" | "ponytail" | "curly";
type Outfit = "shirt" | "blazer" | "hoodie" | "sweater" | "tee" | "jacket";
const LOOK: Record<string, { hair: HairStyle; outfit: Outfit; beard?: boolean; freckles?: boolean }> = {
  veilleur: { hair: "short", outfit: "hoodie" }, verificateur: { hair: "long", outfit: "blazer" },
  analyste: { hair: "wavy", outfit: "shirt" }, enqueteur: { hair: "short", outfit: "jacket", beard: true },
  plume: { hair: "ponytail", outfit: "sweater", freckles: true }, relecteur: { hair: "bald", outfit: "blazer", beard: true },
  chef: { hair: "bun", outfit: "blazer" }, postier: { hair: "short", outfit: "jacket" },
  archiviste: { hair: "bob", outfit: "sweater" }, coach: { hair: "curly", outfit: "tee" }, boss: { hair: "short", outfit: "sweater", beard: true },
};

function mixHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

type Expr = "open" | "closed" | "worry";
function paintFace(skin: string, hair: string, look: { beard?: boolean; freckles?: boolean }, expr: Expr): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d")!;
  const grd = g.createLinearGradient(0, 0, 0, 512); grd.addColorStop(0, mixHex(skin, 8)); grd.addColorStop(1, mixHex(skin, -14));
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
  const cx = 256, cy = 256;
  g.fillStyle = "rgba(225,110,110,0.20)";
  for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 82, cy + 50, 32, 19, 0, 0, TAU); g.fill(); }
  if (look.freckles) { g.fillStyle = "rgba(150,80,50,0.5)"; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(cx + (i % 6 - 2.5) * 16 + (i < 6 ? -62 : 62), cy + 34 + (i % 3) * 9, 2.4, 0, TAU); g.fill(); } }
  for (const s of [-1, 1]) {
    const ex = cx + s * 60, ey = cy - 6;
    if (expr !== "closed") {
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(ex, ey, 25, 17, 0, 0, TAU); g.fill();
      g.fillStyle = "#3a2c22"; g.beginPath(); g.ellipse(ex, ey + 1, 12, 13, 0, 0, TAU); g.fill();
      g.fillStyle = "#14101a"; g.beginPath(); g.arc(ex, ey + 1, 6.5, 0, TAU); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(ex + 4, ey - 4, 3.4, 0, TAU); g.fill();
      g.strokeStyle = "rgba(30,20,20,0.7)"; g.lineWidth = 3; g.beginPath(); g.ellipse(ex, ey, 25, 17, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    } else {
      g.strokeStyle = "#2b2230"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.arc(ex, ey - 6, 20, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    }
    g.strokeStyle = hair; g.lineWidth = 8; g.lineCap = "round"; g.beginPath();
    const inner = expr === "worry" ? -12 : 0;
    g.moveTo(ex - s * 30, ey - 36 + (expr === "worry" ? 4 : 0)); g.lineTo(ex + s * 26, ey - 40 + inner * -1 * 0 + (expr === "worry" ? -9 : 0)); g.stroke();
  }
  g.strokeStyle = mixHex(skin, -55); g.lineWidth = 4; g.lineCap = "round";
  g.beginPath(); g.moveTo(cx, cy + 4); g.quadraticCurveTo(cx + 12, cy + 34, cx - 2, cy + 38); g.stroke();
  if (look.beard) {
    g.fillStyle = mixHex(hair, 6);
    g.beginPath(); g.moveTo(cx - 118, cy + 22); g.quadraticCurveTo(cx - 100, cy + 160, cx, cy + 168); g.quadraticCurveTo(cx + 100, cy + 160, cx + 118, cy + 22);
    g.quadraticCurveTo(cx + 66, cy + 66, cx, cy + 58); g.quadraticCurveTo(cx - 66, cy + 66, cx - 118, cy + 22); g.fill();
  }
  g.strokeStyle = expr === "worry" ? "#5a2a30" : "#8a3f3f"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath();
  if (expr === "worry") { g.moveTo(cx - 24, cy + 76); g.quadraticCurveTo(cx, cy + 60, cx + 24, cy + 76); }
  else if (expr === "closed") { g.moveTo(cx - 14, cy + 70); g.lineTo(cx + 14, cy + 70); }
  else { g.moveTo(cx - 28, cy + 62); g.quadraticCurveTo(cx, cy + 90, cx + 28, cy + 62); }
  g.stroke();
  return c;
}

function textSprite(txt: string, col: string, bg: string): THREE.Texture {
  const c = document.createElement("canvas"); c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 50, 0, TAU); g.fill(); }
  g.fillStyle = col; g.font = "700 76px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------------------------------------

interface Avatar {
  root: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
  faceMat: THREE.MeshStandardMaterial;
  faces: Record<Expr, THREE.Texture>;
  armL: { s: THREE.Group; e: THREE.Group }; armR: { s: THREE.Group; e: THREE.Group };
  legL: { h: THREE.Group; k: THREE.Group }; legR: { h: THREE.Group; k: THREE.Group };
  cup: THREE.Group; fx: THREE.Sprite; seed: number; shoulders: number;
}

function buildAvatar(a: { id: string; shirt: string; hair: string; skin: string; accessory: string }, geo: (key: string, make: () => THREE.BufferGeometry) => THREE.BufferGeometry): Avatar {
  const look = LOOK[a.id] ?? LOOK.veilleur;
  const root = new THREE.Group();
  const skinM = new THREE.MeshStandardMaterial({ color: a.skin, roughness: 0.62 });
  const shirtM = new THREE.MeshStandardMaterial({ color: a.shirt, roughness: 0.72 });
  const pantsM = new THREE.MeshStandardMaterial({ color: a.id === "boss" ? 0x2a2d3e : 0x2c3048, roughness: 0.8 });
  const hairM = new THREE.MeshStandardMaterial({ color: a.hair, roughness: 0.5 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.6 });
  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o; };
  const rbox = (w: number, h: number, d: number, r = 0.05) => geo(`rb${w},${h},${d},${r}`, () => new RoundedBoxGeometry(w, h, d, 3, r));
  const caps = (r: number, l: number) => geo(`cap${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 12));
  const sph = (r: number) => geo(`sp${r}`, () => new THREE.SphereGeometry(r, 20, 14));

  const torso = new THREE.Group(); root.add(torso);
  mesh(rbox(0.66, 0.7, 0.4, 0.13), shirtM, torso, 0, 0.36, 0);
  mesh(sph(0.13), shirtM, torso, -0.34, 0.64, 0); mesh(sph(0.13), shirtM, torso, 0.34, 0.64, 0);
  mesh(geo("neck", () => new THREE.CylinderGeometry(0.075, 0.085, 0.14, 14)), skinM, torso, 0, 0.78, 0);
  const trim = new THREE.MeshStandardMaterial({ color: new THREE.Color(a.shirt).multiplyScalar(0.55), roughness: 0.7 });
  switch (look.outfit) {
    case "shirt": mesh(rbox(0.16, 0.05, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }), torso, -0.09, 0.74, 0.18).rotation.z = 0.5; mesh(rbox(0.16, 0.05, 0.1, 0.01), new THREE.MeshStandardMaterial({ color: 0xe8e8e8 }), torso, 0.09, 0.74, 0.18).rotation.z = -0.5; break;
    case "blazer": mesh(rbox(0.12, 0.5, 0.04, 0.01), new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }), torso, 0, 0.5, 0.2); mesh(rbox(0.12, 0.46, 0.05, 0.02), trim, torso, -0.14, 0.5, 0.2).rotation.z = 0.28; mesh(rbox(0.12, 0.46, 0.05, 0.02), trim, torso, 0.14, 0.5, 0.2).rotation.z = -0.28; break;
    case "hoodie": mesh(geo("hood", () => new THREE.TorusGeometry(0.2, 0.07, 10, 24)), trim, torso, 0, 0.76, -0.04).rotation.x = Math.PI / 2.4; mesh(rbox(0.36, 0.16, 0.05, 0.04), trim, torso, 0, 0.14, 0.2); break;
    case "sweater": mesh(geo("neckring", () => new THREE.TorusGeometry(0.11, 0.035, 8, 20)), new THREE.MeshStandardMaterial({ color: new THREE.Color(a.shirt).multiplyScalar(1.25), roughness: 0.9 }), torso, 0, 0.74, 0.01).rotation.x = Math.PI / 2; break;
    case "jacket": mesh(rbox(0.03, 0.66, 0.04, 0.01), darkM, torso, 0, 0.36, 0.2); mesh(rbox(0.18, 0.06, 0.1, 0.02), trim, torso, -0.1, 0.74, 0.17).rotation.z = 0.55; mesh(rbox(0.18, 0.06, 0.1, 0.02), trim, torso, 0.1, 0.74, 0.17).rotation.z = -0.55; break;
    default: break;
  }
  if (a.accessory === "tie") { mesh(rbox(0.08, 0.46, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: 0xb3322a }), torso, 0, 0.5, 0.21); }

  const mkArm = (side: number) => {
    const s = new THREE.Group(); s.position.set(side * 0.38, 0.64, 0); torso.add(s);
    mesh(caps(0.085, 0.24), shirtM, s, 0, -0.2, 0);
    const e = new THREE.Group(); e.position.y = -0.4; s.add(e);
    mesh(caps(0.075, 0.24), shirtM, e, 0, -0.17, 0);
    mesh(sph(0.085), skinM, e, 0, -0.38, 0);
    return { s, e };
  };
  const armL = mkArm(-1), armR = mkArm(1);
  const cup = new THREE.Group(); cup.visible = false; armR.e.add(cup);
  mesh(geo("cup", () => new THREE.CylinderGeometry(0.07, 0.06, 0.14, 14)), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 }), cup, 0, -0.4, 0.08);
  mesh(geo("cupc", () => new THREE.CylinderGeometry(0.062, 0.062, 0.01, 14)), new THREE.MeshStandardMaterial({ color: 0x5a3320 }), cup, 0, -0.335, 0.08);

  const mkLeg = (side: number) => {
    const h = new THREE.Group(); h.position.set(side * 0.17, 0, 0); root.add(h);
    mesh(caps(0.11, 0.3), pantsM, h, 0, -0.27, 0);
    const k = new THREE.Group(); k.position.y = -0.52; h.add(k);
    mesh(caps(0.09, 0.34), pantsM, k, 0, -0.26, 0);
    mesh(rbox(0.16, 0.09, 0.3, 0.04), darkM, k, 0, -0.54, 0.06);
    return { h, k };
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  mesh(rbox(0.64, 0.2, 0.4, 0.08), pantsM, root, 0, 0.04, 0);

  // tête
  const head = new THREE.Group(); head.position.y = 1.06; torso.add(head);
  const faces: Record<Expr, THREE.Texture> = {
    open: new THREE.CanvasTexture(paintFace(a.skin, a.hair, look, "open")),
    closed: new THREE.CanvasTexture(paintFace(a.skin, a.hair, look, "closed")),
    worry: new THREE.CanvasTexture(paintFace(a.skin, a.hair, look, "worry")),
  };
  Object.values(faces).forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; });
  const faceMat = new THREE.MeshStandardMaterial({ map: faces.open, roughness: 0.6 });
  const hm = mesh(geo("head", () => new THREE.SphereGeometry(0.27, 48, 32)), faceMat, head, 0, 0, 0);
  hm.scale.set(0.95, 1.08, 1.0); head.scale.setScalar(1.14);
  mesh(sph(0.045), skinM, head, -0.25, -0.01, 0); mesh(sph(0.045), skinM, head, 0.25, -0.01, 0);
  const capGeo = (r: number, len: number) => geo(`hc${r},${len}`, () => new THREE.SphereGeometry(r, 36, 20, 0, TAU, 0, len));
  const cap = (r = 0.292, len = 1.75, tilt = -0.42) => { const g = new THREE.Group(); g.rotation.x = tilt; head.add(g); mesh(capGeo(r, len), hairM, g); g.scale.set(0.95, 1.07, 1); return g; };
  switch (look.hair) {
    case "long": { cap(); mesh(rbox(0.5, 0.62, 0.16, 0.08), hairM, head, 0, -0.22, -0.2); break; }
    case "bob": { cap(); mesh(rbox(0.54, 0.34, 0.2, 0.1), hairM, head, 0, -0.08, -0.17); break; }
    case "bun": { cap(); mesh(sph(0.11), hairM, head, 0, 0.3, -0.12); break; }
    case "ponytail": { cap(); const p = mesh(caps(0.06, 0.34), hairM, head, 0.0, -0.1, -0.31); p.rotation.x = 0.5; break; }
    case "wavy": { cap(0.3, 1.8, -0.5); mesh(sph(0.12), hairM, head, 0.12, 0.2, 0.15); break; }
    case "curly": { for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; mesh(sph(0.095), hairM, head, Math.cos(an) * 0.2, 0.2 + Math.sin(i * 1.7) * 0.03, Math.sin(an) * 0.2 - 0.04); } mesh(sph(0.2), hairM, head, 0, 0.22, -0.04); break; }
    case "bald": { mesh(sph(0.08), hairM, head, -0.22, -0.02, -0.08); mesh(sph(0.08), hairM, head, 0.22, -0.02, -0.08); break; }
    default: cap();
  }
  const accM = new THREE.MeshStandardMaterial({ color: 0x20202a, roughness: 0.4, metalness: 0.4 });
  switch (a.accessory) {
    case "glasses": { for (const s of [-1, 1]) { mesh(geo("gl", () => new THREE.TorusGeometry(0.075, 0.011, 8, 24)), accM, head, s * 0.115, 0.025, 0.255); } mesh(rbox(0.07, 0.012, 0.012, 0.004), accM, head, 0, 0.04, 0.262); break; }
    case "cap": { const c = new THREE.MeshStandardMaterial({ color: a.shirt, roughness: 0.7 }); const g = new THREE.Group(); g.rotation.x = -0.5; head.add(g); mesh(capGeo(0.3, 1.25), c, g); g.scale.set(0.99, 1.1, 1.04); mesh(rbox(0.3, 0.025, 0.2, 0.01), c, head, 0, 0.17, 0.3).rotation.x = -0.15; break; }
    case "beret": { const b = mesh(sph(0.33), new THREE.MeshStandardMaterial({ color: 0x8a1e32, roughness: 0.9 }), head, 0.03, 0.27, -0.02); b.scale.set(1, 0.38, 1); b.rotation.z = -0.15; break; }
    case "bow": { const bm = new THREE.MeshStandardMaterial({ color: 0xff6b9d, roughness: 0.5 }); mesh(sph(0.06), bm, head, 0.1, 0.0, -0.31).scale.set(1.6, 1, 0.6); break; }
    case "headset": { mesh(geo("hs", () => new THREE.TorusGeometry(0.29, 0.016, 8, 30, Math.PI)), accM, head, 0, 0.02, 0).rotation.z = 0; for (const s of [-1, 1]) mesh(rbox(0.05, 0.12, 0.1, 0.02), accM, head, s * 0.29, -0.02, 0.01); mesh(caps(0.01, 0.12), accM, head, -0.25, -0.15, 0.12).rotation.z = 1.0; break; }
    default: break;
  }

  const fx = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, opacity: 0 }));
  fx.scale.set(0.55, 0.55, 1); fx.position.set(0.0, 2.15, 0); root.add(fx);
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { root, head, torso, faceMat, faces, armL, armR, legL, legR, cup, fx, seed: a.id.length * 17.3 + a.id.charCodeAt(0), shoulders: 0.64 };
}

type PoseMode = "desk" | "sofa" | "stand";
function pose(av: Avatar, mode: PoseMode, state: AgentState, t: number, walk: boolean, cup: boolean, lookDir: number) {
  const s = av.seed, sleeping = state === "sleeping";
  const k = 1 - Math.exp(-0.2);
  const lerp = (o: THREE.Object3D, ax: "x" | "y" | "z", v: number, f = 0.22) => { o.rotation[ax] += (v - o.rotation[ax]) * f; };
  const seated = mode !== "stand";
  // jambes
  const sw = walk ? Math.sin(t * 7.5) : 0;
  lerp(av.legL.h, "x", seated ? -Math.PI / 2 : sw * 0.7); lerp(av.legR.h, "x", seated ? -Math.PI / 2 : -sw * 0.7);
  lerp(av.legL.k, "x", seated ? Math.PI / 2 : Math.max(0, -sw) * 0.9); lerp(av.legR.k, "x", seated ? Math.PI / 2 : Math.max(0, sw) * 0.9);
  // bras
  const type = state === "working" && mode === "desk";
  const tp = Math.sin(t * 11 + s) * 0.07;
  let lS = -0.9 + (type ? tp : 0), lE = -0.7, rS = -0.9 - (type ? tp : 0), rE = -0.7, rZ = 0, lZ = 0;
  if (mode === "stand") { lS = walk ? sw * 0.6 : Math.sin(t * 1.1 + s) * 0.04; rS = walk ? -sw * 0.6 : 0; lE = rE = -0.1; }
  if (mode === "sofa") { lS = -0.5; lE = -0.9; rS = -0.5; rE = -0.9; }
  if (sleeping && mode === "desk") { lS = -1.25; lE = -0.35; rS = -1.25; rE = -0.35; }
  if (state === "waiting") { rS = 0; rE = -0.3 + Math.sin(t * 5) * 0.35; rZ = 2.5; }
  if (cup) { rS = -0.9; rE = -1.2; rZ = 0; }
  lerp(av.armL.s, "x", lS); lerp(av.armL.e, "x", lE); lerp(av.armR.s, "x", rS); lerp(av.armR.e, "x", rE);
  lerp(av.armR.s, "z", rZ); lerp(av.armL.s, "z", lZ);
  av.cup.visible = cup;
  // torse et tête
  lerp(av.torso, "x", sleeping && mode === "desk" ? 0.55 : mode === "stand" ? 0.02 : 0.03 + Math.sin(t * 1.6 + s) * 0.012);
  const hy = sleeping ? 0 : lookDir !== 0 ? lookDir * 0.5 : seated ? Math.sin(t * 0.55 + s) * 0.35 : Math.sin(t * 0.4 + s) * 0.2;
  lerp(av.head, "y", hy, 0.08); lerp(av.head, "x", sleeping ? 0.45 : state === "error" ? 0.18 : Math.sin(t * 0.7 + s) * 0.04);
  // visage
  const blink = ((t + s) % 4.3) < 0.13;
  const want: Expr = sleeping || blink ? "closed" : state === "error" ? "worry" : "open";
  if (av.faceMat.map !== av.faces[want]) { av.faceMat.map = av.faces[want]; av.faceMat.needsUpdate = true; }
  void k;
}

// ------------------------------------------------------------------------------------------------

function initScene(root: HTMLElement, sim: MutableRefObject<Sim>, onHit: (h: Hit) => void, apiRef: MutableRefObject<FactoryApi | null>): () => void {
  const cleanups: Array<() => void> = [];
  const q = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const listen = (target: EventTarget, type: string, handler: (e: never) => void) => {
    const fn = handler as unknown as EventListener; target.addEventListener(type, fn); cleanups.push(() => target.removeEventListener(type, fn));
  };
  const dispose = () => { for (const fn of cleanups.reverse()) fn(); cleanups.length = 0; };
  const showError = () => { q("loading").classList.add("done"); q("error").style.display = "block"; };
  try {
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, root.clientWidth / Math.max(1, root.clientHeight), 0.1, 200);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); } catch (e) { showError(); throw e; }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    q("scene").appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.065; controls.enablePan = false;
    controls.minDistance = 6; controls.maxDistance = 90; controls.minPolarAngle = 0.09; controls.maxPolarAngle = Math.PI * 0.47; controls.rotateSpeed = 0.5; controls.zoomSpeed = 0.7;
    const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04); scene.environment = env.texture; scene.environmentIntensity = 0.55; room.dispose(); pmrem.dispose();
    const hemi = new THREE.HemisphereLight(0xdbe5f4, 0x29211a, 2);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff1d8, 4.2);
    key.position.set(-6, 16, 10); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -17, right: 17, top: 12, bottom: -12, near: 0.5, far: 50 });
    key.shadow.normalBias = 0.04; key.shadow.bias = -0.0002; key.shadow.radius = 4;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc4d4ed, 2.6); rim.position.set(5, 9, -12); scene.add(rim);
    const warm = new THREE.PointLight(0xffbd42, 40, 30, 2); warm.position.set(-6, 7, 6); scene.add(warm);
    const front = new THREE.DirectionalLight(0xffffff, 1.1); front.position.set(4, 5, 16); scene.add(front);

    const mat = (color: number, metalness = 0.1, roughness = 0.4, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
    const M = {
      body: mat(0x30363f, 0.75, 0.29), base: mat(0x292f37, 0.85, 0.32), edge: mat(0x707986, 0.85, 0.24), chrome: mat(0xc3cad0, 0.92, 0.18),
      dark: mat(0x12171d, 0.45, 0.38), rubber: mat(0x0b1015, 0.1, 0.6), amber: mat(0xff7a1a, 0.52, 0.28), ivory: mat(0xe0ded4, 0.3, 0.4),
      copper: mat(0xc57e45, 0.85, 0.3), wood: mat(0x9a6a40, 0.1, 0.6), light: mat(0xff7a1a, 0.2, 0.25, { emissive: 0xff7a1a, emissiveIntensity: 1.5 }),
      paper: mat(0xf4f1ea, 0, 0.85), plant: mat(0x3f8f55, 0, 0.8), pot: mat(0xa8613f, 0, 0.7), sofa: mat(0x3f6d8a, 0, 0.9), sofaDark: mat(0x335a74, 0, 0.9),
      rug: mat(0x234b5e, 0, 1), white: mat(0xeeeeee, 0.1, 0.4),
    };
    const geometries = new Map<string, THREE.BufferGeometry>();
    const geo = (k: string, make: () => THREE.BufferGeometry) => { if (!geometries.has(k)) geometries.set(k, make()); return geometries.get(k)!; };
    const box = (p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material = M.body, r = 0.04) => {
      const o = new THREE.Mesh(geo(`b${w},${h},${d},${r}`, () => r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d)), m);
      o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o;
    };
    const cyl = (p: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, m: THREE.Material = M.chrome, r2 = r, seg = 24) => {
      const o = new THREE.Mesh(geo(`c${r},${r2},${h},${seg}`, () => new THREE.CylinderGeometry(r, r2, h, seg)), m);
      o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; p.add(o); return o;
    };
    const ball = (p: THREE.Object3D, r: number, x: number, y: number, z: number, m: THREE.Material = M.chrome) => {
      const o = new THREE.Mesh(geo(`s${r}`, () => new THREE.SphereGeometry(r, 16, 12)), m); o.position.set(x, y, z); o.castShadow = true; p.add(o); return o;
    };
    function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void) {
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d")!; draw(ctx, w, h);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { texture: t, ctx, canvas: c };
    }
    const print = (c: CanvasRenderingContext2D, txt: string, x: number, y: number, size = 20, color = "#f4f1ea", weight = 500) => {
      c.fillStyle = color; c.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`; c.fillText(txt, x, y);
    };
    const screen = (p: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, tex: THREE.Texture) => {
      const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); o.position.set(x, y, z); p.add(o); return o;
    };

    const machine = new THREE.Group(); scene.add(machine);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ opacity: 0.25 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.43; floor.receiveShadow = true; scene.add(floor);
    const shadowTex = canvasTexture(128, 128, (c, w, h) => { const g = c.createRadialGradient(64, 64, 12, 64, 64, 64); g.addColorStop(0, "rgba(0,0,0,.8)"); g.addColorStop(0.55, "rgba(0,0,0,.45)"); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(36, 24), new THREE.MeshBasicMaterial({ map: shadowTex.texture, transparent: true, depthWrite: false, opacity: 0.65 }));
    contact.rotation.x = -Math.PI / 2; contact.position.set(0, -0.415, 0.2); scene.add(contact);

    // Plaque métallique
    const PW = 24.6, PD = 15.6, PZ = 0.15;
    box(machine, PW, 0.38, PD, 0, 0.1, PZ, M.base, 0.17);
    box(machine, PW - 0.2, 0.05, PD - 0.18, 0, PLATE_Y - 0.16, PZ, M.edge, 0.11);
    box(machine, PW - 0.3, 0.06, PD - 0.3, 0, PLATE_Y - 0.1, PZ, M.body, 0.1);
    box(machine, PW - 0.1, 0.027, PD - 0.1, 0, -0.1, PZ, M.dark, 0.06);
    box(machine, PW - 1.2, 0.026, 0.03, 0, -0.07, PZ + PD / 2 + 0.01, M.light, 0.01);
    for (const x of [-PW / 2 + 0.9, PW / 2 - 0.9]) for (const z of [PZ - PD / 2 + 0.9, PZ + PD / 2 - 0.9]) { cyl(machine, 0.4, 0.26, x, -0.31, z, M.rubber); cyl(machine, 0.3, 0.09, x, -0.4, z, M.dark); }
    const engr = canvasTexture(1800, 160, (c, w, h) => {
      c.fillStyle = "#252b32"; c.fillRect(0, 0, w, h); c.strokeStyle = "#4d545c"; c.lineWidth = 2; c.strokeRect(2, 2, w - 4, h - 4);
      print(c, "LE BUREAU", 50, 75, 44, "#d9d8cd", 650);
      print(c, "·  repérer  ·  trier  ·  analyser  ·  écrire  ·  valider  ·  envoyer  ·  suivre  ·  s'entraîner", 300, 75, 30, "#b8bdc1", 450);
      print(c, "ÉQUIPE D'AGENTS IA    /    TU VALIDES, ILS PRÉPARENT", 52, 128, 19, "#737e88", 500);
      print(c, "No. 001", 1620, 125, 24, "#c57e45");
    });
    const plate = screen(machine, 12.5, 0.9, -5.2, PLATE_Y - 0.04, PZ + PD / 2 - 0.62, engr.texture); plate.rotation.x = -Math.PI / 2;
    // anneaux de dessin technique
    const lines = new THREE.LineBasicMaterial({ color: 0x69717a, transparent: true, opacity: 0.12 }); const pts: THREE.Vector3[] = [];
    for (const r of [15, 15.9]) for (let i = 0; i < 160; i++) for (const j of [i, i + 1]) { const a = (j / 160) * TAU; pts.push(new THREE.Vector3(Math.cos(a) * r, -0.4, Math.sin(a) * r * 0.6 + 0.15)); }
    scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lines));

    // ---------- Tapis roulant en circuit ----------
    const BZ_A = -6.2, BZ_B = -1.7, BX = 8.9, BR = (BZ_B - BZ_A) / 2, BY = PLATE_Y + 0.3;
    const loopPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 28; i++) loopPts.push(new THREE.Vector3(-BX + (2 * BX * i) / 28, BY, BZ_A));
    for (let i = 1; i < 14; i++) { const a = -Math.PI / 2 + (i / 14) * Math.PI; loopPts.push(new THREE.Vector3(BX + Math.cos(a) * BR, BY, (BZ_A + BZ_B) / 2 + Math.sin(a) * BR)); }
    for (let i = 0; i <= 28; i++) loopPts.push(new THREE.Vector3(BX - (2 * BX * i) / 28, BY, BZ_B));
    for (let i = 1; i < 14; i++) { const a = Math.PI / 2 + (i / 14) * Math.PI; loopPts.push(new THREE.Vector3(-BX + Math.cos(a) * BR, BY, (BZ_A + BZ_B) / 2 + Math.sin(a) * BR)); }
    const path = new THREE.CatmullRomCurve3(loopPts, true, "centripetal");
    const belt = new THREE.Group(); machine.add(belt);
    const frame = new THREE.Mesh(new THREE.TubeGeometry(path, 240, 0.38, 8, true), M.dark); frame.scale.y = 0.28; frame.position.y = -0.26; belt.add(frame);
    const beltCount = 210;
    const slats = new THREE.InstancedMesh(new RoundedBoxGeometry(0.17, 0.07, 0.8, 2, 0.012), M.body, beltCount); slats.receiveShadow = true; belt.add(slats);
    slats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D(), pV = new THREE.Vector3(), tV = new THREE.Vector3();
    const updateBelt = (t: number) => {
      for (let i = 0; i < beltCount; i++) { const u = (i / beltCount + t * 0.0075) % 1; path.getPointAt(u, pV); path.getTangentAt(u, tV); dummy.position.copy(pV); dummy.rotation.set(0, -Math.atan2(tV.z, tV.x), 0); dummy.updateMatrix(); slats.setMatrixAt(i, dummy.matrix); }
      slats.instanceMatrix.needsUpdate = true;
    };
    updateBelt(0);
    for (const side of [-1, 1]) {
      const rp: THREE.Vector3[] = [];
      for (let i = 0; i <= 260; i++) { const u = (i % 260) / 260; path.getPointAt(u, pV); path.getTangentAt(u, tV); rp.push(pV.clone().add(new THREE.Vector3(-tV.z * 0.44 * side, 0.1, tV.x * 0.44 * side))); }
      belt.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rp, true), 260, 0.03, 6, true), M.chrome));
    }
    for (let i = 0; i < 26; i++) { const p = path.getPointAt(i / 26); cyl(belt, 0.05, 0.4, p.x, PLATE_Y + 0.04 - 0.0, p.z, M.chrome); }

    // ---------- Postes ----------
    interface Station {
      id: AgentId | "boss"; name: string; role: string; x: number; z: number; group: THREE.Group; base: THREE.Vector3;
      glow: THREE.MeshStandardMaterial; led: THREE.MeshStandardMaterial; plaque: ReturnType<typeof canvasTexture>; lastState: string; avatar: Avatar | null;
      seat: THREE.Vector3; stand: boolean; shirt: string; idx: number; anim: ((t: number) => void) | null;
    }
    const stations: Station[] = [];
    const avatarGeo = geo;
    const pose0 = (g: THREE.Group, id: string, shirt: string, role: string, name: string, idx: number, boss = false) => {
      const glow = M.light.clone(); glow.emissiveIntensity = 0.5;
      box(g, 3.0, 0.1, 3.2, 0, 0.05, 0.3, M.dark, 0.1);
      box(g, 2.92, 0.03, 3.12, 0, 0.115, 0.3, glow, 0.09);
      box(g, 2.96, 0.08, 3.16, 0, 0.17, 0.3, M.body, 0.09);
      const plaque = canvasTexture(640, 128, () => {});
      const drawPlaque = (state: string) => {
        const c = plaque.ctx; c.clearRect(0, 0, 640, 128); c.fillStyle = "#151a20"; c.fillRect(0, 0, 640, 128);
        print(c, String(idx).padStart(2, "0"), 22, 82, 52, "#ff7a1a", 650); print(c, name.toUpperCase(), 108, 62, 38, "#e4e6e4", 650); print(c, `${role} · ${state}`, 110, 100, 22, "#8a9199", 450);
        plaque.texture.needsUpdate = true;
      };
      drawPlaque("Au travail");
      const pl = screen(g, 2.2, 0.44, 0, 0.36, 1.92, plaque.texture); pl.rotation.x = -0.55;
      return { glow, plaque, drawPlaque };
    };

    const propMaker: Record<string, (g: THREE.Group) => ((t: number) => void) | null> = {
      veilleur: (g) => { cyl(g, 0.05, 1.2, -1.15, 0.7, -0.2); const dish = new THREE.Group(); dish.position.set(-1.15, 1.35, -0.2); g.add(dish); const d = new THREE.Mesh(geo("dish", () => new THREE.SphereGeometry(0.46, 28, 14, 0, TAU, 0, 0.9)), M.chrome); d.rotation.x = Math.PI / 2 + 0.3; d.castShadow = true; dish.add(d); cyl(dish, 0.03, 0.4, 0, 0, 0.2, M.copper).rotation.x = Math.PI / 2; return (t) => { dish.rotation.y = t * 0.6; }; },
      verificateur: (g) => { const m = new THREE.Group(); m.position.set(-1.15, 1.1, 0); g.add(m); const ring = new THREE.Mesh(geo("lens", () => new THREE.TorusGeometry(0.36, 0.05, 12, 32)), M.chrome); ring.castShadow = true; m.add(ring); const gl = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.25, roughness: 0.1 })); m.add(gl); cyl(m, 0.04, 0.55, -0.36, -0.5, 0, M.wood).rotation.z = -0.7; box(g, 0.5, 0.35, 0.5, -1.15, 0.33, 0.4, M.body); return (t) => { m.position.y = 1.1 + Math.sin(t * 1.4) * 0.06; m.rotation.y = Math.sin(t * 0.7) * 0.4; }; },
      analyste: (g) => { const bars: THREE.Mesh[] = []; for (let i = 0; i < 4; i++) { bars.push(box(g, 0.22, 1, 0.22, -1.5 + i * 0.32, 0.6, -0.2, M.light, 0.03)); } box(g, 1.4, 0.06, 0.6, -1.15, 0.3, -0.2, M.dark); return (t) => { bars.forEach((b, i) => { const h = 0.35 + (Math.sin(t * 0.9 + i * 1.3) * 0.5 + 0.5) * 0.9; b.scale.y = h; b.position.y = 0.33 + h / 2; }); }; },
      enqueteur: (g) => { box(g, 1.3, 1.0, 0.07, -1.15, 1.0, -0.3, M.wood); const bm = mat(0xc8a06a, 0, 0.9); box(g, 1.2, 0.9, 0.05, -1.15, 1.0, -0.25, bm, 0.01); const cols = [0xff5a5a, 0x6bd0ff, 0xffd166, 0xa8e6a1]; cols.forEach((c, i) => box(g, 0.22, 0.26, 0.02, -1.5 + (i % 2) * 0.5 + (i > 1 ? 0.1 : 0), 1.15 - Math.floor(i / 2) * 0.4, -0.21, mat(c, 0, 0.9), 0.005)); cyl(g, 0.02, 0.55, -1.15, 0.45, -0.3, M.chrome); return null; },
      plume: (g) => { cyl(g, 0.17, 0.3, -1.1, 0.4, 0.1, M.dark); const q2 = new THREE.Mesh(geo("quill", () => new THREE.ConeGeometry(0.06, 0.9, 10)), mat(0xf4f1ea, 0, 0.8)); q2.position.set(-1.1, 1.0, 0.1); q2.rotation.z = 0.3; q2.castShadow = true; g.add(q2); box(g, 0.7, 0.04, 0.5, -1.4, 0.33, -0.3, M.paper); return (t) => { q2.rotation.z = 0.3 + Math.sin(t * 1.3) * 0.08; }; },
      relecteur: (g) => { for (let i = 0; i < 7; i++) box(g, 0.7, 0.04, 0.5, -1.2, 0.34 + i * 0.045, -0.2, i % 2 ? M.paper : mat(0xfff1c7, 0, 0.9), 0.005); const pn = cyl(g, 0.03, 0.55, -1.1, 0.75, 0.25, mat(0xd6403f, 0.2, 0.4)); pn.rotation.z = 1.0; return null; },
      postier: (g) => { box(g, 0.8, 0.7, 0.55, -1.2, 0.65, -0.2, mat(0x3a6ea8, 0.3, 0.5), 0.06); box(g, 0.6, 0.05, 0.04, -1.2, 0.8, 0.09, M.dark); const flag = box(g, 0.05, 0.4, 0.18, -0.75, 1.0, -0.2, M.light); return (t) => { flag.rotation.z = Math.sin(t * 2) * 0.12; }; },
      archiviste: (g) => { box(g, 0.9, 1.3, 0.6, -1.2, 0.8, -0.2, M.body, 0.04); for (let i = 0; i < 3; i++) { box(g, 0.78, 0.34, 0.03, -1.2, 0.5 + i * 0.4, 0.12, M.edge, 0.01); box(g, 0.2, 0.05, 0.04, -1.2, 0.5 + i * 0.4, 0.15, M.chrome, 0.01); } return null; },
      coach: (g) => { cyl(g, 0.3, 0.06, -1.15, 0.33, 0, M.dark); cyl(g, 0.06, 0.4, -1.15, 0.55, 0, M.chrome); const cp = new THREE.Mesh(geo("trophy", () => new THREE.CylinderGeometry(0.25, 0.1, 0.4, 20)), mat(0xf2c14e, 0.9, 0.2)); cp.position.set(-1.15, 0.95, 0); cp.castShadow = true; g.add(cp); return (t) => { cp.rotation.y = t * 0.8; }; },
      boss: () => null, chef: () => null,
    };

    const agentList = AGENTS.map((a) => ({ ...a }));
    const order: ("boss" | AgentId)[] = ["veilleur", "verificateur", "analyste", "enqueteur", "plume", "relecteur", "boss", "postier", "archiviste", "coach", "chef"];
    order.forEach((id, i) => {
      const isBoss = id === "boss";
      const a = isBoss ? { id: "boss", name: "Yacine", role: "Le boss", shirt: "#2f5d46", hair: "#1b1410", skin: "#c68b5e", accessory: "none" } : agentList.find((x) => x.id === id)!;
      const pos = isBoss ? BOSS_ST : LAYOUT[id as AgentId];
      const stand = !isBoss && !!LAYOUT[id as AgentId].stand;
      const group = new THREE.Group(); group.position.set(pos.x, PLATE_Y, pos.z); machine.add(group);
      const { glow, plaque, drawPlaque } = pose0(group, a.id, a.shirt, a.role, a.name, i + 1);
      const led = mat(0x6bf08f, 0, 0.4, { emissive: 0x6bf08f, emissiveIntensity: 1.2 });
      let anim: ((t: number) => void) | null = null;
      if (stand) {
        // pupitre du chef de bureau
        box(group, 1.1, 1.0, 0.5, 0.0, 0.62, 0.9, M.body, 0.06); const cb = box(group, 0.7, 0.04, 0.5, 0, 1.15, 0.9, M.ivory, 0.01); cb.rotation.x = -0.35;
        box(group, 0.5, 0.35, 0.05, -0.0, 1.22, 0.9, M.dark, 0.01).rotation.x = -0.35;
        ball(group, 0.07, 0.45, 1.2, 0.9, led);
      } else {
        // chaise
        const chairM = mat(new THREE.Color(a.shirt).multiplyScalar(0.3).getHex(), 0.2, 0.8);
        cyl(group, 0.05, 0.35, 0, 0.3, -0.55, M.chrome);
        for (let k = 0; k < 5; k++) { const an = (k / 5) * TAU + 0.3; const arm = box(group, 0.5, 0.04, 0.07, Math.cos(an) * 0.25, 0.14, -0.55 + Math.sin(an) * 0.25, M.dark, 0.01); arm.rotation.y = -an; ball(group, 0.05, Math.cos(an) * 0.5, 0.1, -0.55 + Math.sin(an) * 0.5, M.rubber); }
        box(group, 0.7, 0.1, 0.66, 0, 0.5, -0.55, chairM, 0.05);
        box(group, 0.66, 0.78, 0.1, 0, 0.98, -0.9, chairM, 0.05);
        // bureau
        const dw = isBoss ? 2.7 : 2.0;
        box(group, dw, 0.08, 0.95, 0, 0.82, 0.5, isBoss ? mat(0x7a4b2e, 0.1, 0.55) : M.wood, 0.03);
        box(group, 0.08, 0.78, 0.9, -dw / 2 + 0.06, 0.4, 0.5, M.body, 0.02); box(group, 0.08, 0.78, 0.9, dw / 2 - 0.06, 0.4, 0.5, M.body, 0.02);
        box(group, dw - 0.2, 0.5, 0.05, 0, 0.55, 0.88, M.body, 0.02);
        // moniteur vu de dos, avec le logo de l'agent
        const mon = new THREE.Group(); mon.position.set(isBoss ? -0.4 : 0, 0.86, 0.72); group.add(mon);
        box(mon, 0.95, 0.58, 0.05, 0, 0.62, 0, M.dark, 0.02); cyl(mon, 0.04, 0.3, 0, 0.18, 0, M.dark); box(mon, 0.4, 0.03, 0.22, 0, 0.03, 0, M.dark, 0.01);
        ball(mon, 0.13, 0, 0.64, 0.04, mat(new THREE.Color(a.shirt).getHex(), 0.3, 0.3, { emissive: new THREE.Color(a.shirt).getHex(), emissiveIntensity: 0.6 }));
        ball(mon, 0.03, 0.4, 0.38, 0.04, led);
        // clavier + lampe
        box(group, 0.7, 0.02, 0.24, isBoss ? -0.4 : 0, 0.87, 0.3, M.ivory, 0.01);
        const lamp = new THREE.Group(); lamp.position.set(dw / 2 - 0.35, 0.86, 0.75); group.add(lamp);
        cyl(lamp, 0.1, 0.03, 0, 0.01, 0, M.dark); cyl(lamp, 0.015, 0.5, 0, 0.27, 0, M.dark); const sh = cyl(lamp, 0.13, 0.12, 0.06, 0.55, 0, mat(0xf2c14e, 0.2, 0.5, { emissive: 0xf2c14e, emissiveIntensity: 0.6 }), 0.05); sh.rotation.z = 0.4;
        cyl(group, 0.07, 0.12, -dw / 2 + 0.35, 0.92, 0.3, M.white);
        if (isBoss) {
          // laptop, bannette et papiers
          box(group, 0.9, 0.04, 0.6, 0.45, 0.88, 0.25, M.chrome, 0.01);
          const lid = box(group, 0.9, 0.58, 0.03, 0.45, 1.15, 0.58, M.chrome, 0.01); lid.rotation.x = -0.15;
          const tray = new THREE.Group(); tray.position.set(-1.0, 0.86, 0.6); group.add(tray); (tray.userData as { station?: string }).station = "bannette";
          box(tray, 0.8, 0.1, 0.55, 0, 0.05, 0, M.dark, 0.02);
          const papers: THREE.Mesh[] = []; for (let k = 0; k < 8; k++) papers.push(box(tray, 0.7, 0.035, 0.48, 0, 0.12 + k * 0.04, 0, k % 3 ? M.paper : mat(0xfff1c7, 0, 0.9), 0.004));
          const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: textSprite("0", "#fff", "#e63946"), transparent: true, depthWrite: false })); badge.scale.set(0.5, 0.5, 1); badge.position.set(0.35, 0.9, 0); tray.add(badge);
          let lastN = -1;
          anim = () => { const n = sim.current.pending; if (n !== lastN) { lastN = n; papers.forEach((p, k) => (p.visible = k < Math.min(n * 2, 8))); badge.visible = n > 0; (badge.material as THREE.SpriteMaterial).map = textSprite(String(Math.min(n, 9)), "#fff", "#e63946"); badge.material.needsUpdate = true; } };
        }
        anim = propMaker[id as string]?.(group) ?? anim;
      }
      group.traverse((o) => { o.userData.station = isBoss ? (o.userData.station === "bannette" ? "bannette" : "boss") : id; });
      const av = buildAvatar(a, avatarGeo);
      av.root.position.set(pos.x, PLATE_Y + 0.62, pos.z - 0.55);
      av.root.traverse((o) => { o.userData.station = isBoss ? "boss" : id; });
      machine.add(av.root);
      const st: Station = { id, name: a.name, role: a.role, x: pos.x, z: pos.z, group, base: group.position.clone(), glow, led, plaque, lastState: "", avatar: av, seat: new THREE.Vector3(pos.x, PLATE_Y + 0.62, pos.z - 0.55), stand, shirt: a.shirt, idx: i + 1, anim };
      (st as unknown as { draw: (s: string) => void }).draw = drawPlaque;
      if (stand) { av.root.position.set(pos.x, PLATE_Y + 1.02, pos.z + 0.0); st.seat.set(pos.x, PLATE_Y + 1.02, pos.z + 0.0); }
      stations.push(st);
    });
    // Yacine : bannette cliquable (hit via userData.station)

    // ---------- Salle de pause ----------
    const lounge = new THREE.Group(); machine.add(lounge);
    box(lounge, 7.4, 0.04, 5.6, 8.4, PLATE_Y + 0.03, 5.1, M.rug, 0.02);
    box(lounge, 6.6, 0.045, 4.9, 8.4, PLATE_Y + 0.035, 5.1, mat(0x2f6076, 0, 1), 0.02);
    // canapé
    box(lounge, 4.4, 0.5, 1.15, 7.4, PLATE_Y + 0.25, 3.95, M.sofa, 0.1);
    box(lounge, 4.4, 0.85, 0.32, 7.4, PLATE_Y + 0.6, 3.45, M.sofaDark, 0.1);
    box(lounge, 0.36, 0.7, 1.15, 5.38, PLATE_Y + 0.42, 3.95, M.sofaDark, 0.1); box(lounge, 0.36, 0.7, 1.15, 9.42, PLATE_Y + 0.42, 3.95, M.sofaDark, 0.1);
    [6.4, 7.4, 8.4].forEach((x) => box(lounge, 0.96, 0.14, 0.85, x, PLATE_Y + 0.57, 4.0, mat(0x4c7f9e, 0, 0.9), 0.06));
    box(lounge, 0.5, 0.5, 0.14, 5.95, PLATE_Y + 0.88, 3.7, mat(0xf2c14e, 0, 0.9), 0.06).rotation.z = 0.2; box(lounge, 0.5, 0.5, 0.14, 8.9, PLATE_Y + 0.88, 3.7, mat(0xd4627a, 0, 0.9), 0.06).rotation.z = -0.2;
    // table basse
    box(lounge, 1.7, 0.07, 0.95, 7.4, PLATE_Y + 0.5, 5.7, M.wood, 0.03);
    for (const dx of [-0.75, 0.75]) for (const dz of [-0.38, 0.38]) cyl(lounge, 0.04, 0.46, 7.4 + dx, PLATE_Y + 0.25, 5.7 + dz, M.dark);
    cyl(lounge, 0.1, 0.12, 7.0, PLATE_Y + 0.6, 5.6, M.white); cyl(lounge, 0.1, 0.12, 7.9, PLATE_Y + 0.6, 5.8, mat(0xf2c14e, 0, 0.5)); box(lounge, 0.5, 0.04, 0.36, 7.4, PLATE_Y + 0.56, 5.8, mat(0x3d6b8f, 0, 0.8), 0.005);
    // comptoir café
    box(lounge, 1.3, 1.1, 3.6, 11.3, PLATE_Y + 0.55, 4.7, mat(0xdfe3ea, 0.1, 0.5), 0.05);
    box(lounge, 1.4, 0.07, 3.7, 11.3, PLATE_Y + 1.12, 4.7, mat(0x4a525e, 0.3, 0.4), 0.02);
    const cm = new THREE.Group(); cm.position.set(11.3, PLATE_Y + 1.16, 4.1); lounge.add(cm);
    box(cm, 0.7, 0.85, 0.7, 0, 0.42, 0, mat(0x1b1d24, 0.5, 0.4), 0.06); box(cm, 0.5, 0.18, 0.04, -0.2, 0.7, 0, M.light, 0.01).rotation.y = Math.PI / 2; cyl(cm, 0.06, 0.1, -0.28, 0.25, 0, M.chrome); box(cm, 0.4, 0.04, 0.5, -0.32, 0.08, 0, M.chrome, 0.01);
    cyl(cm, 0.06, 0.1, -0.33, 0.14, 0, M.white);
    cyl(lounge, 0.09, 0.14, 11.3, PLATE_Y + 1.2, 5.2, M.white); cyl(lounge, 0.09, 0.14, 11.1, PLATE_Y + 1.2, 5.5, mat(0xe63946, 0, 0.5));
    box(lounge, 0.5, 1.3, 0.5, 11.35, PLATE_Y + 0.65, 6.7, M.white, 0.06); cyl(lounge, 0.2, 0.5, 11.35, PLATE_Y + 1.6, 6.7, mat(0x7cc4f2, 0, 0.1, { transparent: true, opacity: 0.55 }));
    // plantes, lampadaire, panneau
    const plantAt = (x: number, z: number, s = 1) => { const p = new THREE.Group(); p.position.set(x, PLATE_Y, z); p.scale.setScalar(s); lounge.add(p); cyl(p, 0.3, 0.5, 0, 0.25, 0, M.pot, 0.22); for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(geo("leaf", () => new THREE.SphereGeometry(0.2, 10, 8)), M.plant); l.scale.set(0.5, 1.7, 0.5); const an = (i / 9) * TAU; l.position.set(Math.cos(an) * 0.18, 0.95 + (i % 3) * 0.18, Math.sin(an) * 0.18); l.rotation.set(Math.sin(an) * 0.5, 0, -Math.cos(an) * 0.5); l.castShadow = true; p.add(l); } };
    plantAt(4.4, 7.2, 1.1); plantAt(11.5, 2.3, 1.2); plantAt(-10.6, 4.5, 1.1); plantAt(-10.6, -7.0, 1);
    cyl(lounge, 0.04, 2.0, 5.2, PLATE_Y + 1.0, 3.2, M.dark); const lampShade = cyl(lounge, 0.35, 0.4, 5.2, PLATE_Y + 2.1, 3.2, mat(0xf6e3b0, 0, 0.6, { emissive: 0xf6e3b0, emissiveIntensity: 0.5 }), 0.22);
    const sign = canvasTexture(512, 128, (c) => { c.fillStyle = "#151a20"; c.fillRect(0, 0, 512, 128); print(c, "☕  PAUSE", 40, 84, 60, "#ff7a1a", 650); });
    box(lounge, 0.06, 1.3, 0.06, 4.5, PLATE_Y + 0.65, 7.7, M.dark); const sg = screen(lounge, 1.6, 0.4, 4.5, PLATE_Y + 1.5, 7.74, sign.texture);
    lounge.traverse((o) => { o.userData.station = o.userData.station ?? "lounge"; });
    void sg;

    // ---------- Dossiers sur le tapis ----------
    const stageDefs: [string, string, string][] = [
      ["OFFRE", "repérée", "#c57e45"], ["OFFRE", "vérifiée ✓", "#6a9e6d"], ["ANALYSE", "scores 82 / 74", "#d98c3f"], ["FICHE", "entreprise", "#8a6fb0"],
      ["LETTRE", "brouillon", "#d4627a"], ["LETTRE", "relue ✓", "#5a5a6e"], ["À VALIDER", "dans la bannette", "#e63946"], ["BROUILLON", "prêt (non envoyé)", "#e6b422"],
      ["SUIVI", "relance J+7", "#3f9c9c"], ["ENTRETIEN", "fiche prête", "#2e86de"],
    ];
    const cardTex = stageDefs.map(([title, sub, col]) => canvasTexture(256, 352, (c, w, h) => {
      c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(0, 0, w, 74);
      print(c, title, 20, 52, 34, "#fff", 700); print(c, sub, 20, 112, 22, "rgba(255,255,255,0.92)", 500);
      c.strokeStyle = "rgba(255,255,255,0.55)"; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(20, 160 + i * 30); c.lineTo(w - 20 - (i % 3) * 30, 160 + i * 30); c.stroke(); }
    }).texture);
    const stationU = order.slice(0, 10).map((id) => { const s = stations.find((x) => x.id === id)!; let best = 0, dist = Infinity; const lane = s.z < -2 ? BZ_A : BZ_B; for (let i = 0; i < 400; i++) { const p = path.getPointAt(i / 400); const d = (p.x - s.x) ** 2 + (p.z - lane) ** 2; if (d < dist) { dist = d; best = i / 400; } } return best; });
    const NP = 8;
    const packets: { g: THREE.Group; face: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>; stage: number; u: number }[] = [];
    for (let i = 0; i < NP; i++) {
      const g = new THREE.Group(); machine.add(g);
      box(g, 0.56, 0.78, 0.05, 0, 0.4, 0, M.ivory, 0.02);
      const f = screen(g, 0.5, 0.72, 0, 0.4, 0.03, cardTex[0]) as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
      packets.push({ g, face: f, stage: 0, u: i / NP });
    }

    // ---------- Caméra et modes ----------
    let mode: FactoryMode = "assembled", camMode: FactoryCamera = "overview", playing = !reduceMotion, simTime = 0;
    let selected: string = "veilleur", hovered: string | null = null, lastInteraction = performance.now(), dragging = false, wasDragged = false, downX = 0, downY = 0;
    let width = root.clientWidth, height = root.clientHeight, mobile = width <= 900, cameraAnimating = true, flightTime = 0, visible = true, sized = false, readySent = false;
    const desiredPos = new THREE.Vector3(), desiredTarget = new THREE.Vector3(0, 0.9, 0.5);
    const viewDir = new THREE.Vector3(3.5, 13.5, 13.5).normalize();
    const closeDir = new THREE.Vector3(1.2, 3.6, 11).normalize();
    let baseDistance = 38;
    const layoutCamera = () => {
      if (!root.clientWidth || !root.clientHeight) return;
      const first = !sized; sized = true;
      width = root.clientWidth; height = root.clientHeight; mobile = width <= 900;
      renderer.setSize(width, height); camera.aspect = width / height;
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const hFit = 26.5 / (2 * tanH * (width / height) * (mobile ? 0.95 : 0.9));
      const vFit = 17.5 / (2 * tanH * 0.7);
      baseDistance = Math.max(hFit, vFit);
      controls.maxDistance = Math.max(90, baseDistance * 1.6);
      camera.updateProjectionMatrix(); setGoal(); cameraAnimating = true;
      if (first) { camera.position.copy(desiredPos); controls.target.copy(desiredTarget); controls.update(); cameraAnimating = false; }
    };
    function setGoal() {
      if (mode === "lounge") { desiredTarget.set(8.2, 1.0, 5.0); desiredPos.copy(desiredTarget).addScaledVector(viewDir, mobile ? 17 : 16); return; }
      if (camMode === "station") {
        const s = stations.find((x) => x.id === selected)!;
        desiredTarget.copy(s.group.position).add(new THREE.Vector3(0, 1.45, -0.3)); desiredPos.copy(desiredTarget).addScaledVector(closeDir, mobile ? 9 : 8.5);
      } else {
        desiredTarget.set(0, 0.9, 1.1);
        if (camMode === "side") desiredPos.set(26, 7, 14).normalize().multiplyScalar(baseDistance).add(desiredTarget);
        else if (camMode === "top") desiredPos.set(0.01, baseDistance * 1.02, 1.2).add(desiredTarget);
        else desiredPos.copy(viewDir).multiplyScalar(baseDistance).add(desiredTarget);
      }
    }
    const syncButtons = () => {
      root.querySelectorAll<HTMLElement>("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
      root.querySelectorAll<HTMLElement>("[data-camera]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.camera === camMode && mode !== "lounge")));
      q("journey").classList.toggle("visible", mode === "order");
    };
    const setMode = (m: FactoryMode) => { mode = m; lastInteraction = performance.now(); if (m === "order") { simTime += 0; camMode = "overview"; playing = true; syncPlay(); } else if (camMode === "station") camMode = "overview"; setGoal(); cameraAnimating = true; syncButtons(); };
    const setCamera = (c: FactoryCamera) => { camMode = c; if (mode === "order" || mode === "lounge") mode = "assembled"; lastInteraction = performance.now(); flightTime = 0; setGoal(); cameraAnimating = true; syncButtons(); };
    const focusStation = (id: string) => { if (!stations.find((s) => s.id === id)) return; selected = id; if (mode === "order" || mode === "lounge") mode = "assembled"; camMode = "station"; setGoal(); cameraAnimating = true; syncButtons(); };
    const syncPlay = () => {
      const b = q("play"); b.setAttribute("aria-label", playing ? "Mettre en pause l'animation" : "Relancer l'animation"); b.setAttribute("aria-pressed", String(!playing));
      b.innerHTML = playing ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="2.5" height="10" rx=".5"/><rect x="7.5" y="1" width="2.5" height="10" rx=".5"/></svg>' : '<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1l8 5-8 5z"/></svg>';
    };
    root.querySelectorAll<HTMLElement>("[data-mode]").forEach((b) => listen(b, "click", () => setMode(b.dataset.mode as FactoryMode)));
    root.querySelectorAll<HTMLElement>("[data-camera]").forEach((b) => listen(b, "click", () => setCamera(b.dataset.camera as FactoryCamera)));
    listen(q("play"), "click", () => { playing = !playing; syncPlay(); });
    syncPlay();

    // bulles
    const bubbleLayer = q("bubbles");
    const bubbles = new Map<string, { el: HTMLDivElement; until: number }>();
    const say = (id: AgentId | "boss", text: string, ms = 5200) => {
      let b = bubbles.get(id);
      if (!b) { const el = document.createElement("div"); el.className = "bubble"; bubbleLayer.appendChild(el); b = { el, until: 0 }; bubbles.set(id, b); }
      const name = id === "boss" ? "Yacine" : AGENTS.find((a) => a.id === id)?.name ?? "";
      b.el.innerHTML = `<span class="who"></span><span class="txt"></span>`; b.el.querySelector(".who")!.textContent = name; b.el.querySelector(".txt")!.textContent = text; b.until = performance.now() + ms; b.el.style.display = "block";
    };
    cleanups.push(() => bubbles.forEach((b) => b.el.remove()));
    apiRef.current = { say, setMode, setCamera, focus: (id) => focusStation(id) };
    (window as unknown as { __factory?: FactoryApi }).__factory = apiRef.current;
    cleanups.push(() => { if (apiRef.current) apiRef.current = null; });

    layoutCamera();
    camera.position.copy(desiredPos); controls.target.copy(desiredTarget); controls.update(); cameraAnimating = false;
    listen(window, "resize", layoutCamera);
    const ro = new ResizeObserver(() => layoutCamera()); ro.observe(root); cleanups.push(() => ro.disconnect());
    controls.addEventListener("start", () => { dragging = true; cameraAnimating = false; lastInteraction = performance.now(); });
    controls.addEventListener("end", () => { dragging = false; lastInteraction = performance.now(); });

    // interaction
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), tooltip = q("tooltip");
    const pickables = [machine];
    const hitAt = (x: number, y: number): string | null => {
      pointer.set((x / width) * 2 - 1, (-y / height) * 2 + 1); raycaster.setFromCamera(pointer, camera);
      for (const h of raycaster.intersectObjects(pickables, true)) { let o: THREE.Object3D | null = h.object; while (o) { const s = o.userData.station as string | undefined; if (s && s !== "lounge") return s; o = o.parent; } if (h.object.userData.station === "lounge") return "lounge"; }
      return null;
    };
    const rectOf = () => root.getBoundingClientRect();
    listen(renderer.domElement, "pointermove", (e: PointerEvent) => {
      const r = rectOf(); const px = e.clientX - r.left, py = e.clientY - r.top;
      if (Math.hypot(px - downX, py - downY) > 5) wasDragged = true;
      if (dragging) return;
      const id = hitAt(px, py); hovered = id;
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
      tooltip.classList.toggle("visible", !!id && id !== "lounge");
      if (id && id !== "lounge") {
        const st = stations.find((s) => s.id === id); const title = id === "bannette" ? "Bannette « À valider »" : st ? `${st.name} · ${st.role}` : id;
        tooltip.querySelector("strong")!.textContent = title;
        tooltip.querySelector("p")!.textContent = id === "bannette" ? `${sim.current.pending} dossier(s) à valider` : st ? (st.id === "boss" ? "Clique pour ouvrir la file de validation." : `${STATE_LABEL[sim.current.states[st.id as AgentId]]}. Clique pour voir son journal.`) : "";
        tooltip.style.left = Math.min(width - 255, Math.max(10, px + 16)) + "px"; tooltip.style.top = Math.max(10, Math.min(height - 95, py - 65)) + "px";
      }
    });
    listen(renderer.domElement, "pointerleave", () => { hovered = null; tooltip.classList.remove("visible"); });
    listen(renderer.domElement, "pointerdown", (e: PointerEvent) => { const r = rectOf(); downX = e.clientX - r.left; downY = e.clientY - r.top; wasDragged = false; tooltip.classList.remove("visible"); });
    listen(renderer.domElement, "pointerup", (e: PointerEvent) => {
      if (wasDragged) return;
      const r = rectOf(); const id = hitAt(e.clientX - r.left, e.clientY - r.top);
      if (!id) return;
      if (id === "lounge") { setMode("lounge"); return; }
      if (id === "bannette") { onHit({ kind: "bannette" }); return; }
      if (id === "boss") { onHit({ kind: "boss" }); return; }
      focusStation(id); onHit({ kind: "agent", id: id as AgentId });
    });
    listen(document, "visibilitychange", () => { visible = !document.hidden; last = performance.now(); });
    const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting && !document.hidden; last = performance.now(); }, { threshold: 0.01 }); io.observe(renderer.domElement); cleanups.push(() => io.disconnect());

    // textures d'effets
    const fxTex = { zzz: textSprite("Zzz", "#e8f0ff", ""), warn: textSprite("!", "#fff", "#e9a824"), err: textSprite("!", "#fff", "#d6403f") };

    // déplacement des agents
    interface Mover { pos: THREE.Vector3; path: THREE.Vector3[]; mode: "seat" | "break"; spot: number | null; face: number; sit: boolean }
    const movers = new Map<string, Mover>();
    stations.forEach((s) => { if (s.id !== "boss") movers.set(s.id, { pos: s.seat.clone(), path: [], mode: "seat", spot: null, face: 0, sit: false }); });
    const toV = (x: number, z: number, y: number) => new THREE.Vector3(x, y, z);
    const walkY = PLATE_Y + 1.02;
    const confettiCanvas = q<HTMLCanvasElement>("confetti"); const cctx = confettiCanvas.getContext("2d")!;
    const confetti: { x: number; y: number; vx: number; vy: number; col: string; rot: number }[] = [];
    let lastConfetti = 0;
    const journey: [string, string][] = [["Offre repérée", "Hugo trouve l'offre"], ["Offre vérifiée", "Inès : en ligne, trajet ok"], ["Offre analysée", "Max : scores et alertes"], ["Fiche entreprise", "Léon cherche l'angle"], ["Lettre rédigée", "Colette écrit"], ["Lettre relue", "Gustave contrôle"], ["À valider", "Dans la bannette de Yacine"], ["Brouillon prêt", "Fernand : rien n'est envoyé sans toi"], ["Suivi", "Odile programme les relances"], ["Entretien", "Rudy prépare la fiche"]];

    const scratch = new THREE.Vector3();
    let last = performance.now(), rafId = 0, frames = 0, measure = 0, pixel = renderer.getPixelRatio(), nightLerp = 0;
    const clockEl = q("clock"), statusText = q("status-text"), statusEl = q("status");
    const labels = q("labels"); const labelEls = new Map<string, HTMLDivElement>();
    cleanups.push(() => labels.replaceChildren());

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05)); last = now;
      if (!visible) return;
      if (playing) { simTime += dt; flightTime += dt; }
      const t = simTime, s = sim.current;
      nightLerp += ((s.night ? 1 : 0) - nightLerp) * Math.min(1, dt * 2);
      hemi.intensity = 2 - nightLerp * 1.45; key.intensity = 4.2 - nightLerp * 3.4; front.intensity = 1.1 - nightLerp * 0.8; rim.intensity = 2.6 - nightLerp * 1.2; warm.intensity = 40 + nightLerp * 40; renderer.toneMappingExposure = 1.12 - nightLerp * 0.25;
      scene.environmentIntensity = 0.55 - nightLerp * 0.35;
      const awake = Object.values(s.states).filter((x) => x !== "sleeping").length;
      statusText.textContent = awake === 0 ? "L'équipe dort" : `${awake} agents actifs`;
      statusEl.classList.toggle("paused", !playing || awake === 0);
      clockEl.textContent = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

      // pauses : attribution de places et trajets
      const taken = new Set<number>(); movers.forEach((m) => { if (m.spot !== null) taken.add(m.spot); });
      stations.forEach((st) => {
        if (st.id === "boss") return;
        const m = movers.get(st.id)!; const state = s.states[st.id as AgentId];
        const wantBreak = state === "coffee";
        if (wantBreak && m.mode === "seat" && m.path.length === 0) {
          const free = SPOTS.map((_, i) => i).filter((i) => !taken.has(i));
          if (free.length) {
            const idx = free[Math.floor(Math.random() * free.length)]; const sp = SPOTS[idx]; taken.add(idx); m.spot = idx; m.mode = "break";
            const y = walkY; const p: THREE.Vector3[] = [];
            if (!st.stand) { p.push(toV(st.x + 1.8, st.seat.z, y)); p.push(toV(st.x + 1.8, 2.5, y)); } else p.push(toV(st.x, 2.5, y));
            sp.via.forEach(([vx, vz]) => p.push(toV(vx, vz, y))); p.push(toV(sp.x, sp.z, sp.sit ? PLATE_Y + 0.57 + 0.14 : y));
            m.path = p;
          }
        } else if (!wantBreak && m.mode === "break") {
          const sp = m.spot !== null ? SPOTS[m.spot] : null; const y = walkY; const p: THREE.Vector3[] = [];
          if (sp && m.path.length === 0) { [...sp.via].reverse().forEach(([vx, vz]) => p.push(toV(vx, vz, y))); }
          if (!st.stand) { p.push(toV(st.x + 1.8, 2.5, y)); p.push(toV(st.x + 1.8, st.seat.z, y)); p.push(st.seat.clone()); } else { p.push(toV(st.x, 2.5, y)); p.push(st.seat.clone()); }
          m.path = p; m.mode = "seat"; m.spot = null; m.sit = false;
        }
        if (m.path.length) {
          const tgt = m.path[0]; const dx = tgt.x - m.pos.x, dz = tgt.z - m.pos.z, dy = tgt.y - m.pos.y; const d = Math.hypot(dx, dz);
          const step = 2.6 * dt;
          if (d <= step) { m.pos.copy(tgt); m.path.shift(); } else { m.pos.x += (dx / d) * step; m.pos.z += (dz / d) * step; m.pos.y += dy * Math.min(1, step / d); m.face = Math.atan2(dx, dz); }
        }
      });

      // stations : animation, état, plaque
      stations.forEach((st, i) => {
        const g = st.group; g.position.copy(st.base);
        const state = st.id === "boss" ? (s.night ? "sleeping" : "working") : s.states[st.id as AgentId];
        const pulse = Math.pow(Math.max(0, Math.sin((t * TAU) / 4 - i * 0.9)), 7);
        const lit = hovered === st.id || (camMode === "station" && selected === st.id);
        st.glow.emissiveIntensity += ((lit ? 3.5 : state === "sleeping" ? 0.12 : 0.55 + pulse * 0.65) - st.glow.emissiveIntensity) * Math.min(1, dt * 5);
        const col = state === "error" ? 0xff5a5a : state === "waiting" ? 0xe9a824 : state === "sleeping" ? 0x555566 : 0x6bf08f;
        st.led.color.setHex(col); st.led.emissive.setHex(col);
        if (st.lastState !== state) { st.lastState = state; (st as unknown as { draw: (x: string) => void }).draw(STATE_LABEL[state as AgentState] ?? "Au travail"); }
        st.anim?.(t);
        const av = st.avatar!;
        if (st.id === "boss") { av.root.position.copy(st.seat); av.root.rotation.y = 0; pose(av, "desk", state as AgentState, t, false, false, 0); av.fx.material.opacity = 0; return; }
        const m = movers.get(st.id)!;
        const moving = m.path.length > 0;
        const seatedAtDesk = m.mode === "seat" && !moving;
        const onSofa = m.mode === "break" && !moving && m.spot !== null && SPOTS[m.spot].sit;
        const pm: PoseMode = st.stand ? "stand" : seatedAtDesk ? "desk" : onSofa ? "sofa" : "stand";
        const cup = m.mode === "break" && !moving;
        av.root.position.copy(seatedAtDesk ? st.seat : m.pos);
        if (seatedAtDesk && !st.stand) av.root.position.copy(st.seat);
        if (!moving && m.mode === "break" && m.spot !== null) av.root.rotation.y = SPOTS[m.spot].face;
        else if (moving) av.root.rotation.y += (Math.atan2(Math.sin(m.face - av.root.rotation.y), Math.cos(m.face - av.root.rotation.y))) * Math.min(1, dt * 8);
        else av.root.rotation.y += (0 - av.root.rotation.y) * Math.min(1, dt * 6);
        pose(av, pm, state as AgentState, t, moving, cup, moving ? 0.5 : 0);
        // écran d'état au-dessus de la tête
        const mat2 = av.fx.material as THREE.SpriteMaterial;
        if (state === "sleeping") { mat2.map = fxTex.zzz; mat2.opacity = 0.75 + Math.sin(t * 2 + i) * 0.2; av.fx.position.y = 2.3 + Math.sin(t * 1.5 + i) * 0.1; }
        else if (state === "waiting") { mat2.map = fxTex.warn; mat2.opacity = 1; av.fx.position.y = 2.4 + Math.sin(t * 5) * 0.08; }
        else if (state === "error") { mat2.map = fxTex.err; mat2.opacity = 1; av.fx.position.y = 2.4 + Math.sin(t * 7) * 0.05; }
        else mat2.opacity = 0;
        mat2.needsUpdate = true;
      });

      // dossiers
      const speed = 0.0075;
      packets.forEach((p, i) => {
        const u = ((i / NP + t * speed) % 1 + 1) % 1; path.getPointAt(u, scratch); path.getTangentAt(u, tV);
        p.g.position.copy(scratch); p.g.position.y = BY + 0.04; p.g.rotation.y = 0; // la face reste tournée vers la caméra
        let best = 0, bd = 2;
        stationU.forEach((su, k) => { const d = (u - su + 1) % 1; if (d < bd) { bd = d; best = k; } });
        const stage = Math.min(best, 9);
        if (p.stage !== stage) { p.stage = stage; p.face.material.map = cardTex[stage]; p.face.material.needsUpdate = true; }
      });
      if (t - lastDraw > 1 / 20 || lastDraw < 0) { updateBelt(t); lastDraw = t; }

      // mode « une offre » : la caméra suit le premier dossier
      if (mode === "order") {
        const p = packets[0]; const stg = p.stage;
        if (stg !== lastJourney) { q("journey-title").textContent = journey[stg][0]; q("journey-detail").textContent = journey[stg][1]; lastJourney = stg; }
        q("journey-progress").style.width = (((0 / NP + t * speed) % 1) * 100) + "%";
        if (!dragging && playing) { desiredTarget.copy(p.g.position); desiredPos.copy(desiredTarget).addScaledVector(viewDir, mobile ? 11 : 14); cameraAnimating = true; }
      } else if (camMode === "flight" && playing && !dragging && mode !== "lounge") {
        const a = flightTime * 0.1, d = baseDistance;
        desiredTarget.set(0, 0.9, 1.1); desiredPos.set(Math.sin(a + 0.3) * d * 0.5, d * 0.52 + Math.sin(a * 0.7) * 1.5, Math.cos(a + 0.3) * d * 0.9).add(desiredTarget); cameraAnimating = true;
      } else if (camMode === "station" && cameraAnimating) setGoal();
      if (cameraAnimating && !dragging) {
        const k = 1 - Math.exp(-dt * (mode === "order" ? 2.2 : 3));
        camera.position.lerp(desiredPos, k); controls.target.lerp(desiredTarget, k);
        if (camMode !== "flight" && mode !== "order" && camera.position.distanceTo(desiredPos) < 0.02 && controls.target.distanceTo(desiredTarget) < 0.02) cameraAnimating = false;
      }
      controls.autoRotate = playing && !reduceMotion && !dragging && !cameraAnimating && mode === "assembled" && camMode === "overview" && now - lastInteraction > 9000;
      controls.autoRotateSpeed = 0.18; controls.update(dt);

      // étiquettes des postes
      const showLabels = mode === "stations";
      stations.forEach((st) => {
        let el = labelEls.get(st.id as string);
        if (!el) { el = document.createElement("div"); el.className = "station-label"; el.innerHTML = `<div class="stem"></div><div class="label-card"><div class="label-title"><span></span><b></b></div><div class="label-meta"></div></div>`; labels.appendChild(el); labelEls.set(st.id as string, el); }
        el.classList.toggle("visible", showLabels);
        if (!showLabels) return;
        scratch.copy(st.group.position).add(new THREE.Vector3(0, 3.1, 0)).project(camera);
        const x = Math.max(8, Math.min(width - 150, (scratch.x * 0.5 + 0.5) * width - 62)), y = Math.max(70, Math.min(height - 190, (-scratch.y * 0.5 + 0.5) * height - 56));
        el.style.transform = `translate(${x}px,${y}px)`;
        el.querySelector("span")!.textContent = String(st.idx).padStart(2, "0"); el.querySelector("b")!.textContent = st.name;
        el.querySelector(".label-meta")!.textContent = `${st.role} · ${st.id === "boss" ? "Validation" : STATE_LABEL[s.states[st.id as AgentId]]}`;
      });
      // bulles
      bubbles.forEach((b, id) => {
        if (now > b.until) { b.el.style.display = "none"; return; }
        const st = stations.find((x) => x.id === id); if (!st) return;
        const av = st.avatar!; av.head.getWorldPosition(scratch); scratch.y += 0.75; scratch.project(camera);
        const bx = (scratch.x * 0.5 + 0.5) * width, by = (-scratch.y * 0.5 + 0.5) * height;
        b.el.style.left = bx + "px"; b.el.style.top = by + "px";
      });
      // confettis
      if (s.confettiAt !== lastConfetti) { lastConfetti = s.confettiAt; for (let i = 0; i < 170; i++) confetti.push({ x: Math.random() * width, y: -Math.random() * 80, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140, rot: Math.random() * 6, col: ["#ffd23f", "#e63946", "#2e86de", "#52a860", "#ff9fb5"][i % 5] }); }
      if (confettiCanvas.width !== width || confettiCanvas.height !== height) { confettiCanvas.width = width; confettiCanvas.height = height; }
      cctx.clearRect(0, 0, width, height);
      for (let i = confetti.length - 1; i >= 0; i--) { const p = confetti[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 6; if (p.y > height + 10) { confetti.splice(i, 1); continue; } cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.rot); cctx.fillStyle = p.col; cctx.fillRect(-4, -2, 8, 4); cctx.restore(); }

      renderer.render(scene, camera);
      if (!readySent && sized) { readySent = true; q("loading").classList.add("done"); }
      if (playing) { frames++; measure += dt; if (measure > 4) { if (frames / measure < 40 && pixel > 1) { pixel = Math.max(1, pixel - 0.25); renderer.setPixelRatio(pixel); } frames = 0; measure = 0; } }
    };
    let lastDraw = -1, lastJourney = -1;
    rafId = requestAnimationFrame(animate);
    cleanups.push(() => {
      cancelAnimationFrame(rafId); controls.dispose();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const list = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []; list.forEach((mm) => { Object.values(mm).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); }); mm.dispose(); }); });
      geometries.forEach((g) => g.dispose()); env.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    });
  } catch (err) {
    console.error("Factory3D : échec du démarrage", err); showError();
  }
  return dispose;
}

// ------------------------------------------------------------------------------------------------

const STYLES = String.raw`
.f3d{position:relative;width:100%;overflow:hidden;background:#000;border:1px solid #ffffff14;border-radius:14px;color:#f4f1ea;font-size:13px;--amber:#ff7a1a;--line:rgba(244,241,234,.11);contain:layout}
.f3d,.f3d *{box-sizing:border-box}
.f3d button{font:inherit;color:inherit;cursor:pointer}
.f3d button:focus-visible{outline:2px solid var(--amber);outline-offset:4px}
.f3d #scene{position:absolute;inset:0;touch-action:none}
.f3d #scene canvas{display:block;width:100%;height:100%}
.f3d #confetti{position:absolute;inset:0;pointer-events:none;width:100%;height:100%;z-index:6}
.f3d .vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 46%,transparent 34%,rgba(0,0,0,.14) 66%,rgba(0,0,0,.7) 100%)}
.f3d .topbar{position:absolute;inset:22px 26px auto;display:flex;justify-content:space-between;align-items:center;pointer-events:none}
.f3d .identity{display:flex;gap:13px;align-items:center}
.f3d .mark{width:30px;height:30px;border:1px solid #55502f;border-radius:9px;display:grid;place-items:center;color:var(--amber);background:#1c1b14}
.f3d .identity strong{display:block;font-weight:550;letter-spacing:-.2px}
.f3d .identity small{display:block;margin-top:5px;font-size:9px;letter-spacing:1.4px;color:#73777f;text-transform:uppercase}
.f3d .status{display:flex;align-items:center;gap:8px;font-size:10px;color:#a6a79f}
.f3d .status i{width:5px;height:5px;border-radius:50%;background:var(--amber);box-shadow:0 0 10px #ff7a1a60}
.f3d .status.paused i{background:#777;box-shadow:none}
.f3d .status span:last-child{font-variant-numeric:tabular-nums;color:#646971;margin-left:12px}
.f3d .scene-heading{position:absolute;top:92px;left:26px;display:flex;align-items:center;gap:12px;font-size:9px;letter-spacing:1.8px;color:#959790;text-transform:uppercase;pointer-events:none}
.f3d .scene-heading:before{content:"";width:22px;height:1px;background:var(--amber)}
.f3d .scene-heading .index{color:#4e535b;letter-spacing:1px;margin-left:8px}
.f3d .controls{position:absolute;bottom:58px;left:20px;right:20px;display:flex;align-items:center;flex-direction:column;gap:14px;z-index:5}
.f3d .mode-bar{display:flex;gap:3px;padding:5px;border:1px solid #ffffff13;border-radius:12px;background:rgba(25,28,32,.87);box-shadow:0 8px 30px #0003;backdrop-filter:blur(16px)}
.f3d .mode-bar button{border:0;background:none;color:#a2a4a8;white-space:nowrap;padding:10px 14px;display:flex;gap:8px;align-items:center;font-size:11px;font-weight:500;border-radius:8px;transition:background .2s,color .2s}
.f3d .mode-bar button:hover{background:#ffffff08;color:#f4f1ea}
.f3d .mode-bar button[aria-pressed=true]{background:var(--amber);color:#211c0d}
.f3d svg{flex-shrink:0;display:block}
.f3d .mode-bar svg{width:14px;height:14px}
.f3d .camera-row{display:flex;align-items:center;justify-content:center;gap:4px}
.f3d .camera-row .caption{font-size:9px;letter-spacing:1.4px;color:#555b65;margin-right:9px}
.f3d .camera-row button{border:0;background:transparent;color:#6e747e;padding:5px 9px;font-size:10px;transition:color .2s}
.f3d .camera-row button:hover,.f3d .camera-row button[aria-pressed=true]{color:#f4f1ea}
.f3d .camera-row button[aria-pressed=true]:after{content:"";display:block;width:3px;height:3px;background:var(--amber);border-radius:50%;margin:5px auto -8px}
.f3d .camera-row .divider{width:1px;height:13px;background:var(--line);margin:0 8px}
.f3d .camera-row #play{padding:5px;width:25px;height:25px;display:grid;place-items:center}
.f3d .footer{position:absolute;bottom:20px;left:26px;right:26px;display:flex;align-items:center;justify-content:space-between;gap:12px;pointer-events:none}
.f3d .wordmark{font-size:11px;color:#6d7178}
.f3d .hint{display:flex;align-items:center;gap:7px;color:#636972;font-size:10px}
.f3d #labels,.f3d #bubbles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.f3d .bubble{position:absolute;display:none;transform:translate(-50%,-100%);background:#fff;color:#1b1b2e;border-radius:10px;padding:5px 9px;font-size:11.5px;line-height:1.3;width:max-content;max-width:190px;box-shadow:0 3px 14px rgba(0,0,0,.45);z-index:4}
.f3d .bubble:after{content:"";position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-bottom:0;border-top-color:#fff}
.f3d .bubble .who{display:block;font-weight:700;color:#b5560f;font-size:10px}
.f3d .station-label{position:absolute;left:0;top:0;opacity:0;transition:opacity .3s;will-change:transform;min-width:128px}
.f3d .station-label.visible{opacity:1}
.f3d .station-label .stem{height:20px;width:1px;background:linear-gradient(#ff7a1a00,#ff7a1a70);margin-left:10px}
.f3d .station-label .label-card{background:#14171bee;backdrop-filter:blur(10px);border:1px solid #ff7a1a40;border-radius:6px;padding:8px 11px;box-shadow:0 4px 20px #0003}
.f3d .label-title{font-weight:550;font-size:12px;display:flex;gap:9px;align-items:center;white-space:nowrap}
.f3d .label-title span{color:var(--amber);font:9px ui-monospace,Menlo,monospace}
.f3d .label-meta{font-size:9px;color:#8e939c;margin:5px 0 0 24px;white-space:nowrap}
.f3d #tooltip{position:absolute;pointer-events:none;z-index:10;opacity:0;transition:opacity .15s;padding:10px 13px;border:1px solid #ffffff1a;background:#171a20ed;backdrop-filter:blur(12px);box-shadow:0 8px 32px #0005;border-radius:7px;max-width:240px}
.f3d #tooltip.visible{opacity:1}
.f3d #tooltip strong{font-size:12px;font-weight:550}
.f3d #tooltip p{font-size:10px;color:#9b9fa7;margin:5px 0 0;line-height:1.5}
.f3d #journey{position:absolute;left:26px;right:26px;top:120px;opacity:0;transform:translateY(-5px);transition:.4s;pointer-events:none;display:flex;align-items:center;gap:13px}
.f3d #journey.visible{opacity:1;transform:none}
.f3d .journey-icon{width:28px;height:28px;border:1px solid #ff7a1a40;border-radius:50%;display:grid;place-items:center;color:var(--amber)}
.f3d #journey strong{font-size:11px;font-weight:500}
.f3d #journey small{display:block;font-size:9px;margin-top:4px;color:#7e858d}
.f3d #journey .track{height:2px;background:#ffffff0b;flex:1;margin-left:8px}
.f3d #journey .track i{display:block;height:100%;background:var(--amber);width:0}
.f3d #loading{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:12px;color:#8c8f95;font-size:11px;transition:opacity .4s;z-index:20}
.f3d #loading i{height:18px;width:18px;border-radius:50%;border:1px solid #ff7a1a22;border-top-color:var(--amber);animation:f3d-spin 1s linear infinite}
@keyframes f3d-spin{to{transform:rotate(360deg)}}
.f3d #loading.done{opacity:0;pointer-events:none}
.f3d #error{position:absolute;left:27%;right:27%;top:38%;border:1px solid #ff7a1a30;background:#191b1f;padding:22px;border-radius:12px;display:none;line-height:1.7}
.f3d #error strong{color:var(--amber);font-weight:500}.f3d #error p{color:#9da1a8;margin:8px 0 0}
.f3d #error button{border:1px solid #ffffff22;background:#25292e;padding:8px 14px;border-radius:5px;margin-top:12px}
@media (max-width:900px){.f3d .topbar{inset:16px 14px auto}.f3d .identity small{display:none}.f3d .scene-heading{display:none}.f3d .controls{bottom:50px;left:8px;right:8px}.f3d .mode-bar button{padding:9px 9px;font-size:10px;gap:5px}.f3d .mode-bar svg{display:none}.f3d .hint{display:none}.f3d #journey{top:70px;left:14px;right:14px}}
@media (prefers-reduced-motion:reduce){.f3d,.f3d *{transition:none!important}.f3d #loading i{animation:none}}
`;

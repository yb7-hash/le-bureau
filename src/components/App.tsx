"use client";

import Link from "next/link";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Factory3D, { type FactoryApi, type Hit, type Sim } from "./Factory3D";
import {
  AGENTS, KANBAN_CARDS, KANBAN_COLUMNS, OFFERS, PIPELINE, REFUS_RAISONS, STATS,
  type Agent, type AgentId, type AgentState, type Offer,
} from "@/lib/data";

interface FeedItem { id: number; at: number; agent: AgentId; type: string; msg: string; link?: string }
type Panel = null | { k: "agent"; id: AgentId } | { k: "valid" } | { k: "stats" } | { k: "kanban" };
type TimeMode = "auto" | "day" | "night";

// Version publique : pas de page Réglages ni d'accès à la base.
const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";

const STATE_LABEL: Record<AgentState, string> = {
  working: "Au travail", coffee: "Pause café", waiting: "Attend Yacine", error: "En erreur", sleeping: "Endormi",
};
const REFUS_REPONSE: Record<string, string> = {
  "Trop commercial": "Noté, moins de postes orientés vente.",
  "Trop loin": "Noté, je durcis le filtre trajet.",
  "Poste solo": "Noté, je pénalise les postes sans équipe.",
  "Salaire trop flou": "Noté, j'alerte quand le salaire manque.",
  "Secteur peu intéressant": "Noté, je baisse ce secteur dans le score.",
  Autre: "Noté, je m'en souviendrai.",
};
const hhmm = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

function computeAsleep(mode: TimeMode): { asleep: boolean; night: boolean } {
  if (mode === "day") return { asleep: false, night: false };
  if (mode === "night") return { asleep: true, night: true };
  const d = new Date(), h = d.getHours(), weekend = d.getDay() === 0 || d.getDay() === 6;
  const night = h < 7 || h >= 20;
  return { asleep: night || weekend || h < 8 || h >= 19, night };
}

export default function App() {
  const sim = useRef<Sim>({
    states: Object.fromEntries(AGENTS.map((a) => [a.id, "working"])) as Record<AgentId, AgentState>,
    folders: [], pending: OFFERS.length, night: false, confettiAt: 0,
  });
  const [states, setStates] = useState<Record<AgentId, AgentState>>(sim.current.states);
  const [bubbles, setBubbles] = useState<Partial<Record<AgentId | "boss", string>>>({});
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState<AgentId | "all">("all");
  const [panel, setPanel] = useState<Panel>(null);
  const [mode, setMode] = useState<TimeMode>("auto");
  const [view, setView] = useState<"bureau" | "liste">("bureau");
  const [brief, setBrief] = useState(true);
  const [wide, setWide] = useState(false);
  const [decided, setDecided] = useState<Record<string, "validée" | "refusée">>({});
  const [letters, setLetters] = useState<Record<string, string>>(Object.fromEntries(OFFERS.map((o) => [o.id, o.lettre])));
  const factory = useRef<FactoryApi | null>(null);
  const nextId = useRef(100);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const say = useCallback((who: AgentId | "boss", text: string, ms = 5200) => {
    factory.current?.say(who, text, ms);
    setBubbles((b) => ({ ...b, [who]: text }));
    clearTimeout(timers.current[who]);
    timers.current[who] = setTimeout(() => setBubbles((b) => ({ ...b, [who]: undefined })), ms);
  }, []);

  const log = useCallback((agent: AgentId, type: string, msg: string, link?: string, at = Date.now()) => {
    setFeed((f) => [{ id: nextId.current++, at, agent, type, msg, link }, ...f].slice(0, 80));
  }, []);

  const setState = useCallback((id: AgentId, s: AgentState) => {
    sim.current.states[id] = s;
    setStates({ ...sim.current.states });
  }, []);

  // vue par défaut selon l'écran, et amorçage du fil
  useEffect(() => {
    if (window.matchMedia("(max-width: 720px)").matches) setView("liste");
    const now = Date.now();
    const seed: [AgentId, string, string, number][] = [
      ["chef", "brief", "a préparé le brief du matin", 3],
      ["veilleur", "collecte", "a trouvé 14 offres via France Travail", 52],
      ["verificateur", "tri", "a écarté 4 doublons et 2 offres trop loin", 47],
      ["analyste", "analyse", "a noté 7 offres (3 cœur de cible)", 40],
      ["enqueteur", "fiche", "a terminé 3 fiches entreprise", 31],
      ["plume", "lettre", "a rédigé 3 lettres de moins de 250 mots", 22],
      ["relecteur", "renvoi", "a renvoyé une lettre à la Plume (formule creuse)", 15],
      ["plume", "lettre", "a repris la lettre après la relecture", 11],
      ["relecteur", "validation", "a validé 3 lettres : elles sont dans la bannette", 6],
    ];
    setFeed(seed.map(([agent, type, msg, m], i) => ({ id: i, agent, type, msg, at: now - m * 60000, link: type === "validation" ? "bannette" : undefined })).reverse());
    say("chef", "Cette nuit : 14 offres, 7 gardées, 3 lettres prêtes. Elles t'attendent dans la bannette ☕", 9000);
  }, [say]);

  // simulation du bureau
  useEffect(() => {
    const tick = () => {
      const { asleep, night } = computeAsleep(modeRef.current);
      sim.current.night = night;
      if (asleep) {
        const next = { ...sim.current.states };
        AGENTS.forEach((a) => (next[a.id] = "sleeping"));
        sim.current.states = next;
        setStates(next);
        if (Math.random() < 0.3) { const a = pick(AGENTS); say(a.id, pick(a.bubbles.sleeping), 3500); }
        return;
      }
      // réveil
      AGENTS.forEach((a) => { if (sim.current.states[a.id] === "sleeping") sim.current.states[a.id] = "working"; });
      setStates({ ...sim.current.states });
      const a = pick(AGENTS);
      const r = Math.random();
      if (sim.current.states[a.id] === "coffee") return;
      const onBreak = Object.values(sim.current.states).filter((x) => x === "coffee").length;
      if (r < 0.22 && onBreak < 4) {
        setState(a.id, "coffee"); say(a.id, pick(a.bubbles.coffee), 4500);
        setTimeout(() => sim.current.states[a.id] === "coffee" && setState(a.id, "working"), 16000 + Math.random() * 8000);
      } else if (r < 0.2) {
        setState(a.id, "error"); say(a.id, pick(a.bubbles.error)); log(a.id, "erreur", "rencontre un souci et réessaie");
        setTimeout(() => sim.current.states[a.id] === "error" && setState(a.id, "working"), 6000);
      } else if (r < 0.3 && (a.id === "chef" || a.id === "postier" || a.id === "relecteur")) {
        setState(a.id, "waiting"); say(a.id, pick(a.bubbles.waiting));
        setTimeout(() => sim.current.states[a.id] === "waiting" && setState(a.id, "working"), 6000);
      } else {
        say(a.id, pick(a.bubbles.working)); log(a.id, "action", pick(a.events));
        const idx = PIPELINE.indexOf(a.id);
        if (idx >= 0) {
          if (a.id === "relecteur" && Math.random() < 0.5) {
            sim.current.folders.push({ from: "relecteur", to: "plume", start: performance.now(), dur: 2600, red: true });
            say("plume", "Retour de dossier : je corrige ça.", 4500);
          } else if (idx < PIPELINE.length - 1) {
            sim.current.folders.push({ from: a.id, to: PIPELINE[idx + 1], start: performance.now(), dur: 2600 });
          }
        }
      }
    };
    const id = setInterval(tick, 4200);
    tick();
    return () => clearInterval(id);
  }, [say, log, setState]);

  // changement de mode jour/nuit immédiat
  useEffect(() => {
    const { asleep, night } = computeAsleep(mode);
    sim.current.night = night;
    const next = { ...sim.current.states };
    AGENTS.forEach((a) => (next[a.id] = asleep ? "sleeping" : next[a.id] === "sleeping" ? "working" : next[a.id]));
    sim.current.states = next;
    setStates(next);
    if (!asleep) say("chef", "Bonjour ! Café en main, tout le monde est à son poste ☀️", 4500);
  }, [mode, say]);

  const queue = OFFERS.filter((o) => !decided[o.id]);
  sim.current.pending = queue.length;

  const onHit = (h: Hit) => {
    if (h.kind === "agent") setPanel({ k: "agent", id: h.id });
    else if (h.kind === "bannette" || h.kind === "boss") setPanel({ k: "valid" });
    else if (h.kind === "cork") setPanel({ k: "stats" });
    else if (h.kind === "white") setPanel({ k: "kanban" });
    else say("chef", "La machine à café : c'est ici que les agents attendent quand une limite d'API est atteinte.", 6000);
  };

  const celebrate = () => {
    sim.current.confettiAt = performance.now();
    say("chef", "Réponse positive ! Tout le monde debout 🎉", 6000);
    AGENTS.forEach((a, i) => setTimeout(() => say(a.id, pick(["🎉", "Bravo Yacine !", "On l'a fait !", "Entretien en vue 👀"]), 4000), i * 150));
    log("archiviste", "réponse", "a détecté une réponse positive d'un recruteur (démo)");
    log("coach", "entretien", "prépare la fiche entretien pour ce poste (démo)");
  };
  const decide = (o: Offer, d: "validée" | "refusée", raison?: string) => {
    setDecided((x) => ({ ...x, [o.id]: d }));
    if (d === "validée") {
      log("postier", "brouillon", `prépare un brouillon pour « ${o.titre} ». Rien n'est envoyé sans ton clic.`);
      say("postier", "Brouillon Gmail prêt. Je ne l'envoie pas : c'est à toi de cliquer.", 6000);
    } else {
      log("analyste", "apprentissage", `refus de « ${o.titre} » (${raison}), critères ajustés`);
      say("analyste", REFUS_REPONSE[raison ?? "Autre"], 6000);
      say("chef", "Un refus, ça arrive. Le prochain dossier sera mieux ciblé 💪", 6000);
    }
  };

  const shown = useMemo(() => feed.filter((f) => filter === "all" || f.agent === filter), [feed, filter]);
  const agentOf = (id: AgentId) => AGENTS.find((a) => a.id === id)!;
  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Le Bureau</h1>
          <p className="sub">L'équipe d'agents de recherche d'emploi de Yacine <span className="demo-badge">Mode démo · données fictives</span></p>
        </div>
        <div className="controls">
          <div className="seg" role="group" aria-label="Heure du bureau">
            {(["auto", "day", "night"] as TimeMode[]).map((m) => (
              <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "auto" ? "Auto" : m === "day" ? "Jour" : "Nuit"}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Affichage">
            <button className={view === "bureau" ? "on" : ""} onClick={() => setView("bureau")}>Bureau</button>
            <button className={view === "liste" ? "on" : ""} onClick={() => setView("liste")}>Liste</button>
          </div>
          {!DEMO && <Link className="btn ghost" href="/reglages">⚙ Réglages</Link>}
          <button className="btn" onClick={() => setPanel({ k: "valid" })}>À valider <b className="pill">{queue.length}</b></button>
        </div>
      </header>

      {brief && (
        <div className="brief" role="status">
          <b>Brief du matin, par Madeleine</b>
          <ul>
            <li>14 offres collectées, 7 gardées après tri (trajet, doublons, exclusions).</li>
            <li>3 lettres relues et prêtes dans ta bannette, {queue.length} à décider.</li>
            <li>2 relances à faire cette semaine. Aucune réponse reçue cette nuit.</li>
          </ul>
          <button className="x" onClick={() => setBrief(false)} aria-label="Fermer le brief">×</button>
        </div>
      )}

      <main className={`main${wide ? " wide" : ""}`}>
        <section className="stage">
          {view === "bureau" ? (
            <div className="canvas-wrap">
              <Factory3D sim={sim} onHit={onHit} apiRef={factory} height={wide ? "min(82vh, 860px)" : "min(74vh, 780px)"} />
            </div>
          ) : (
            <ul className="cards">
              {AGENTS.map((a) => (
                <li key={a.id}>
                  <button className="card" onClick={() => setPanel({ k: "agent", id: a.id })}>
                    <span className="dot" style={{ background: a.shirt }} />
                    <span className="meta"><b>{a.name}</b> · {a.role}<br /><span className={`chip s-${states[a.id]}`}>{STATE_LABEL[states[a.id]]}</span></span>
                    <span className="say">{bubbles[a.id] ?? a.bubbles[states[a.id]][0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button className="btn ghost" onClick={() => setPanel({ k: "stats" })}>📌 Statistiques</button>
            <button className="btn ghost" onClick={() => setPanel({ k: "kanban" })}>🗂 Pipeline</button>
            <button className="btn ghost" onClick={() => setWide((w) => !w)}>{wide ? "⤡ Réduire" : "⤢ Agrandir"}</button>
            <button className="btn ghost" onClick={celebrate}>🎉 Simuler une réponse positive</button>
            <button className="btn ghost" onClick={() => say("chef", "Un refus ne dit rien de ta valeur. On affine et on repart 💪", 6000)}>Simuler un refus</button>
          </div>
        </section>

        <aside className="feed" aria-label="Fil d'actualité du bureau">
          <div className="feed-head">
            <h2>Fil d'actualité</h2>
            <select value={filter} onChange={(e) => setFilter(e.target.value as AgentId | "all")} aria-label="Filtrer par agent">
              <option value="all">Tous les agents</option>
              {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}, {a.role}</option>)}
            </select>
          </div>
          <ol>
            {shown.map((f) => {
              const a = agentOf(f.agent);
              return (
                <li key={f.id}>
                  <time>{hhmm(f.at)}</time>
                  <span className="dot" style={{ background: a.shirt }} />
                  <span><b>{a.name}</b> {f.msg}{f.link && <> · <button className="link" onClick={() => setPanel({ k: "valid" })}>voir</button></>}</span>
                </li>
              );
            })}
          </ol>
        </aside>
      </main>

      {panel && (
        <div className="overlay" onClick={() => setPanel(null)}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button className="x" onClick={() => setPanel(null)} aria-label="Fermer">×</button>
            {panel.k === "agent" && <AgentPanel agent={agentOf(panel.id)} state={states[panel.id]} feed={feed.filter((f) => f.agent === panel.id)} />}
            {panel.k === "valid" && <Validation queue={queue} letters={letters} setLetters={setLetters} decide={decide} />}
            {panel.k === "stats" && <Stats />}
            {panel.k === "kanban" && <Kanban />}
          </div>
        </div>
      )}
      <footer className="foot">Phase 1 : décor et données fictives. Aucune offre réelle, aucun envoi possible.</footer>
    </div>
  );
}

function AgentPanel({ agent, state, feed }: { agent: Agent; state: AgentState; feed: FeedItem[] }) {
  return (
    <div>
      <h2>{agent.name}, {agent.role}</h2>
      <p><span className={`chip s-${state}`}>{STATE_LABEL[state]}</span></p>
      <h3>Journal</h3>
      {feed.length === 0 ? <p className="muted">Rien pour l'instant.</p> : (
        <ol className="log">{feed.slice(0, 12).map((f) => <li key={f.id}><time>{hhmm(f.at)}</time> {f.msg}</li>)}</ol>
      )}
    </div>
  );
}

function Score({ label, v }: { label: string; v: number }) {
  return (
    <div className="score" aria-label={`${label} ${v} sur 100`}>
      <span>{label}</span>
      <div className="bar"><i style={{ width: `${v}%` }} /></div>
      <b>{v}</b>
    </div>
  );
}

function Validation({ queue, letters, setLetters, decide }: {
  queue: Offer[]; letters: Record<string, string>; setLetters: (f: (p: Record<string, string>) => Record<string, string>) => void;
  decide: (o: Offer, d: "validée" | "refusée", raison?: string) => void;
}) {
  const [i, setI] = useState(0);
  const [refusing, setRefusing] = useState(false);
  const [raison, setRaison] = useState(REFUS_RAISONS[0]);
  if (queue.length === 0) return <div><h2>À valider</h2><p className="muted">La bannette est vide. Madeleine te prévient dès qu'un dossier arrive ☕</p></div>;
  const o = queue[Math.min(i, queue.length - 1)];
  return (
    <div>
      <h2>À valider <span className="muted">({queue.length})</span></h2>
      <div className="tabs">{queue.map((q, k) => <button key={q.id} className={q.id === o.id ? "on" : ""} onClick={() => { setI(k); setRefusing(false); }}>{q.entreprise.split(" (")[0]}</button>)}</div>
      <h3>{o.titre}</h3>
      <p className="muted">{o.entreprise} · {o.lieu} · {o.trajet} min depuis Paris 14e · via {o.source}</p>
      <p><span className="chip">{o.niveau}</span></p>
      <Score label="Compétences" v={o.scoreCompetences} />
      <Score label="Environnement" v={o.scoreEnvironnement} />
      <ul className="three">
        <li><b>Atouts.</b> {o.atouts}</li>
        <li><b>Ce qui manque.</b> {o.manques}</li>
        <li><b>Signaux d'alerte.</b> {o.alertes}</li>
      </ul>
      <h4>Fiche entreprise</h4>
      <p>{o.fiche}</p>
      <h4>Lettre (modifiable)</h4>
      <textarea value={letters[o.id]} onChange={(e) => setLetters((p) => ({ ...p, [o.id]: e.target.value }))} rows={9} />
      {!refusing ? (
        <div className="row">
          <button className="btn ok" onClick={() => decide(o, "validée")}>Valider</button>
          <button className="btn ghost" onClick={() => document.querySelector<HTMLTextAreaElement>(".modal textarea")?.focus()}>Modifier</button>
          <button className="btn danger" onClick={() => setRefusing(true)}>Refuser</button>
        </div>
      ) : (
        <div className="row">
          <label>Raison du refus <select value={raison} onChange={(e) => setRaison(e.target.value)}>{REFUS_RAISONS.map((r) => <option key={r}>{r}</option>)}</select></label>
          <button className="btn danger" onClick={() => { decide(o, "refusée", raison); setRefusing(false); setI(0); }}>Confirmer le refus</button>
          <button className="btn ghost" onClick={() => setRefusing(false)}>Annuler</button>
        </div>
      )}
      <p className="muted small">Valider ne fait rien partir : le Postier prépare un brouillon, et c'est toi qui cliques sur Envoyer.</p>
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <div className="bars">
      <h4>{title}</h4>
      {rows.map(([k, v]) => (
        <div key={k} className="bar-row"><span>{k}</span><div className="bar"><i style={{ width: `${(v / max) * 100}%` }} /></div><b>{v}</b></div>
      ))}
    </div>
  );
}

function Stats() {
  return (
    <div>
      <h2>Tableau de liège</h2>
      <div className="kpis">
        <div><b>{STATS.offresVues}</b><span>offres vues</span></div>
        <div><b>{STATS.candidaturesEnvoyees}</b><span>candidatures envoyées</span></div>
        <div><b>{STATS.tauxReponse} %</b><span>taux de réponse</span></div>
        <div><b>{STATS.entretiens}</b><span>entretiens</span></div>
      </div>
      <Bars title="Offres vues par plateforme" rows={STATS.parPlateforme} />
      <Bars title="Candidatures par niveau de métier" rows={STATS.parNiveau} />
      <Bars title="Candidatures par semaine" rows={STATS.parSemaine} />
      <p className="muted small">Chiffres fictifs de démonstration.</p>
    </div>
  );
}

function Kanban() {
  return (
    <div>
      <h2>Pipeline de l'Archiviste</h2>
      <div className="kanban">
        {KANBAN_COLUMNS.map((c) => (
          <div key={c} className="col"><h4>{c} <span className="muted">{KANBAN_CARDS[c].length}</span></h4>
            {KANBAN_CARDS[c].map((t) => <div key={t} className="note">{t}</div>)}
          </div>
        ))}
      </div>
      <p className="muted small">Données fictives.</p>
    </div>
  );
}

"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  experienceStages,
  NeuronRecord,
  RegistryStatus,
  registryStatusLabels,
  seededNeurons,
} from "../data/system-design";
import styles from "./system-design.module.css";

const STORAGE_KEY = "banc-system-design-neuron-drafts-v1";

const emptyDraft = (): NeuronRecord => ({
  id: "",
  cellType: "",
  displayName: "",
  behavior: "",
  dataset: "BANC v888",
  count: null,
  rootIds: [],
  staticAsset: "",
  sequenceAsset: "",
  frameCount: null,
  color: "#70d8ce",
  status: "planned",
  evidence: "",
  caveat: "",
});

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function SystemDesignPage() {
  const [selectedStageId, setSelectedStageId] = useState("seek");
  const [drafts, setDrafts] = useState<NeuronRecord[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<NeuronRecord>(emptyDraft);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | RegistryStatus>("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setDrafts(JSON.parse(saved) as NeuronRecord[]);
    } catch {
      // A malformed local draft should never block the design view.
    }
  }, []);

  const allNeurons = useMemo(() => [...seededNeurons, ...drafts], [drafts]);
  const selectedStage = experienceStages.find((stage) => stage.id === selectedStageId) ?? experienceStages[0];
  const selectedNeuronIds = new Set(selectedStage.neurons);
  const filteredNeurons = allNeurons.filter((neuron) => {
    const haystack = `${neuron.cellType} ${neuron.displayName} ${neuron.behavior} ${neuron.dataset}`.toLowerCase();
    return (status === "all" || neuron.status === status) && haystack.includes(query.toLowerCase());
  });

  const saveDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const record = { ...draft, id: draft.id || `${slugify(draft.cellType || draft.displayName)}-${Date.now()}` };
    const next = [...drafts, record];
    setDrafts(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setDraft(emptyDraft());
    setFormOpen(false);
  };

  const deleteDraft = (id: string) => {
    const next = drafts.filter((item) => item.id !== id);
    setDrafts(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const exportRegistry = async () => {
    await navigator.clipboard.writeText(JSON.stringify(allNeurons, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>BANC EXPLORER · INTERNAL SYSTEM MAP</span>
          <h1>Behavior &amp; neuron registry</h1>
          <p>One place to see what appears, where it appears, and which neural assets drive each moment.</p>
        </div>
        <nav className={styles.headerActions} aria-label="System page actions">
          <Link href="/" className={styles.secondaryButton}>Open simulation</Link>
          <button type="button" className={styles.secondaryButton} onClick={exportRegistry}>{copied ? "Copied" : "Copy registry JSON"}</button>
          <button type="button" className={styles.primaryButton} onClick={() => setFormOpen((open) => !open)}>+ Add neuron set</button>
        </nav>
      </header>

      <section className={styles.summary} aria-label="System summary">
        <div><span>Experience stages</span><strong>{experienceStages.length}</strong></div>
        <div><span>Neuron sets</span><strong>{allNeurons.length}</strong></div>
        <div><span>Live in app</span><strong>{allNeurons.filter((item) => item.status === "live").length}</strong></div>
        <div><span>Need metadata</span><strong>{allNeurons.filter((item) => item.status === "needs-ids").length}</strong></div>
      </section>

      {formOpen && (
        <section className={styles.editor} aria-labelledby="new-neuron-title">
          <div className={styles.sectionHeading}>
            <div><span>REGISTRY EDITOR</span><h2 id="new-neuron-title">Add a neuron set</h2></div>
            <button type="button" className={styles.textButton} onClick={() => setFormOpen(false)}>Close</button>
          </div>
          <form onSubmit={saveDraft} className={styles.formGrid}>
            <label>Cell type<input required value={draft.cellType} onChange={(e) => setDraft({ ...draft, cellType: e.target.value })} placeholder="e.g. DNp03" /></label>
            <label>Display name<input required value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} placeholder="What visitors see" /></label>
            <label>Behavior<input required value={draft.behavior} onChange={(e) => setDraft({ ...draft, behavior: e.target.value })} placeholder="e.g. quick flight dodge" /></label>
            <label>Status<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RegistryStatus })}>{Object.entries(registryStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Dataset<input value={draft.dataset} onChange={(e) => setDraft({ ...draft, dataset: e.target.value })} /></label>
            <label>Cell count<input type="number" min="0" value={draft.count ?? ""} onChange={(e) => setDraft({ ...draft, count: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label className={styles.wide}>Root IDs<textarea value={draft.rootIds.join("\n")} onChange={(e) => setDraft({ ...draft, rootIds: e.target.value.split(/[\s,]+/).filter(Boolean) })} placeholder="One root ID per line" /></label>
            <label>Static asset<input value={draft.staticAsset} onChange={(e) => setDraft({ ...draft, staticAsset: e.target.value })} placeholder="banc-example.webp" /></label>
            <label>Animated sequence<input value={draft.sequenceAsset} onChange={(e) => setDraft({ ...draft, sequenceAsset: e.target.value })} placeholder="folder/frame-{00..15}.webp" /></label>
            <label>Frame count<input type="number" min="0" value={draft.frameCount ?? ""} onChange={(e) => setDraft({ ...draft, frameCount: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label>Highlight color<input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} /></label>
            <label className={styles.wide}>Evidence / verification<textarea value={draft.evidence} onChange={(e) => setDraft({ ...draft, evidence: e.target.value })} /></label>
            <label className={styles.wide}>Scientific caveat<textarea value={draft.caveat} onChange={(e) => setDraft({ ...draft, caveat: e.target.value })} /></label>
            <div className={styles.formActions}><button type="submit" className={styles.primaryButton}>Save local draft</button><small>Drafts stay in this browser until copied into the project registry.</small></div>
          </form>
        </section>
      )}

      <section className={styles.flowSection} aria-labelledby="flow-title">
        <div className={styles.sectionHeading}>
          <div><span>STATE MACHINE</span><h2 id="flow-title">Visitor journey</h2></div>
          <p>Select a node to inspect its world, HUD, dialog, and neuron contract.</p>
        </div>
        <div className={styles.flow}>
          {experienceStages.map((stage, index) => (
            <div className={styles.flowItem} key={stage.id}>
              <button
                type="button"
                className={`${styles.node} ${stage.id === selectedStageId ? styles.selectedNode : ""}`}
                onClick={() => setSelectedStageId(stage.id)}
                aria-pressed={stage.id === selectedStageId}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{stage.label}</strong>
                <small>{stage.worldState}</small>
              </button>
              {index < experienceStages.length - 1 && <i aria-hidden="true">→</i>}
            </div>
          ))}
        </div>

        <article className={styles.stageDetail}>
          <div className={styles.stageTitle}>
            <div><span>SELECTED STAGE · {selectedStage.worldState}</span><h3>{selectedStage.label}</h3></div>
            <code>{selectedStage.circuitMode}</code>
          </div>
          <dl className={styles.contractGrid}>
            <div><dt>Entry trigger</dt><dd>{selectedStage.trigger}</dd></div>
            <div><dt>Timing / exit</dt><dd>{selectedStage.duration}</dd></div>
            <div><dt>Fly world</dt><dd>{selectedStage.world.join(" · ")}</dd></div>
            <div><dt>Neural HUD</dt><dd>{selectedStage.hud.join(" · ") || "None"}</dd></div>
            <div><dt>Dialog</dt><dd>{selectedStage.dialog.join(" · ") || "None"}</dd></div>
            <div><dt>Next state</dt><dd>{selectedStage.next.join(" / ")}</dd></div>
          </dl>
          <div className={styles.stageNeurons}>
            <span>NEURONS SHOWN</span>
            {selectedStage.neurons.map((id) => {
              const neuron = allNeurons.find((item) => item.id === id);
              return neuron ? <button type="button" key={id} style={{ "--node-color": neuron.color } as React.CSSProperties} onClick={() => setQuery(neuron.cellType)}>{neuron.cellType}<small>{registryStatusLabels[neuron.status]}</small></button> : null;
            })}
          </div>
        </article>
      </section>

      <section className={styles.tableSection} aria-labelledby="registry-title">
        <div className={styles.sectionHeading}>
          <div><span>ASSET &amp; EVIDENCE TABLE</span><h2 id="registry-title">Neuron registry</h2></div>
          <div className={styles.filters}>
            <input aria-label="Search neuron registry" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search cell type or behavior" />
            <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as "all" | RegistryStatus)}><option value="all">All statuses</option>{Object.entries(registryStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Neuron set</th><th>Behavior</th><th>Cells / IDs</th><th>What renders</th><th>Status</th><th>Evidence guardrail</th><th></th></tr></thead>
            <tbody>
              {filteredNeurons.map((neuron) => (
                <tr key={neuron.id} className={selectedNeuronIds.has(neuron.id) ? styles.activeRow : ""}>
                  <td><span className={styles.colorDot} style={{ background: neuron.color }} /><strong>{neuron.cellType}</strong><small>{neuron.displayName}<br />{neuron.dataset}</small></td>
                  <td>{neuron.behavior}</td>
                  <td><strong>{neuron.count ?? "—"}</strong><small>{neuron.rootIds.length ? `${neuron.rootIds.length} IDs recorded` : "IDs not recorded here"}</small></td>
                  <td><code>{neuron.staticAsset || "No static"}</code><small>{neuron.sequenceAsset || "No sequence"}{neuron.frameCount ? ` · ${neuron.frameCount} frames` : ""}</small></td>
                  <td><span className={`${styles.status} ${styles[neuron.status]}`}>{registryStatusLabels[neuron.status]}</span></td>
                  <td>{neuron.evidence}<small>{neuron.caveat}</small></td>
                  <td>{drafts.some((item) => item.id === neuron.id) && <button type="button" className={styles.deleteButton} onClick={() => deleteDraft(neuron.id)}>Delete draft</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className={styles.footer}>
        <p><strong>Rule:</strong> a behavior can enter the public simulation only after its IDs, dataset version, render assets, evidence, and caveat are all recorded.</p>
        <Link href="/credits">Evidence &amp; credits →</Link>
      </footer>
    </main>
  );
}

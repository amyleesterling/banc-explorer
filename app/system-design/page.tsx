"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import {
  derivedByMode,
  derivedNeurons,
  experienceStages,
} from "../data/system-design";
import type { CircuitMode } from "../data/game-model";
import styles from "./system-design.module.css";

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Everything on this page is read out of the game itself: the circuit table,
// the layer table, the sequence map and the measured layer statistics. Nothing
// here is typed by hand, so the page cannot describe a build that no longer
// exists. When a layer changes in the experience it changes here on the next
// build, without anyone remembering to update a list.
//
// The previous version kept a draft registry in localStorage. That was a
// per-browser scratchpad rather than a shared record, so it is gone.
export default function SystemDesignPage() {
  const [selectedStageId, setSelectedStageId] = useState(experienceStages[0].id);
  const [query, setQuery] = useState("");

  const selectedStage = useMemo(
    () => experienceStages.find((stage) => stage.id === selectedStageId) ?? experienceStages[0],
    [selectedStageId],
  );

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return derivedNeurons;
    return derivedNeurons.filter((row) =>
      `${row.mode} ${row.label} ${row.types} ${row.summary} ${row.dataset ?? ""}`
        .toLowerCase()
        .includes(needle));
  }, [query]);

  const animated = derivedNeurons.filter((row) => row.sequence).length;
  const measured = derivedNeurons.filter((row) => row.cells !== null).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span>SYSTEM DESIGN</span>
          <h1>Behavior &amp; neuron registry</h1>
          <p>
            Every stage of the visitor journey, and the cell types the experience
            shows at that stage. Read from the build, not from a copy of it.
          </p>
        </div>
        <Link className={styles.backLink} href={`${assetBase}/`}>← Back to the fly</Link>
      </header>

      <div className={styles.summaryRow}>
        <div><strong>{experienceStages.length}</strong><span>stages</span></div>
        <div><strong>{derivedNeurons.length}</strong><span>circuit layers</span></div>
        <div><strong>{animated}</strong><span>animated sequences</span></div>
        <div><strong>{measured}</strong><span>with measured counts</span></div>
      </div>

      <section className={styles.flowSection} aria-labelledby="flow-title">
        <div className={styles.sectionHeading}>
          <div><span>STATE MACHINE</span><h2 id="flow-title">Visitor journey</h2></div>
          <p>Select a stage to see what the world, the HUD and the neurons do there.</p>
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
            <span>NEURONS SHOWN AT THIS STAGE</span>
            {selectedStage.neurons.map((mode: CircuitMode) => {
              const row = derivedByMode[mode];
              if (!row) return null;
              return (
                <button
                  type="button"
                  key={mode}
                  style={{ "--node-color": row.accent } as CSSProperties}
                  onClick={() => setQuery(row.types.split(" ")[0])}
                >
                  {row.types}
                  <small>
                    {row.cells !== null ? `${row.cells} cells` : "count not measured"}
                    {row.sequence ? ` · ${row.loopSeconds}s loop` : " · still"}
                  </small>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <section className={styles.registrySection} aria-labelledby="registry-title">
        <div className={styles.sectionHeading}>
          <div><span>REGISTRY</span><h2 id="registry-title">Cell types by behavior</h2></div>
          <input
            aria-label="Search the neuron registry"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cell type, behavior or dataset"
          />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Behavior</th>
                <th>Cell types</th>
                <th>Cells</th>
                <th>Synapses (in + out)</th>
                <th>Dataset</th>
                <th>What renders</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.mode}>
                  <th scope="row">
                    <i style={{ "--node-color": row.accent } as CSSProperties} aria-hidden="true" />
                    {row.label}
                    <code>{row.mode}</code>
                  </th>
                  <td className={styles.types}>{row.types}</td>
                  <td>{row.cells ?? "—"}</td>
                  <td>{row.synapses !== null ? row.synapses.toLocaleString() : "—"}</td>
                  <td>{row.dataset ?? "—"}</td>
                  <td className={styles.renders}>
                    {row.sequence
                      ? <>
                          <code>{row.sequence}</code>
                          <small>
                            {row.frames} frames, {row.loopSeconds}s loop
                            {row.overlay && " · overlay on the EPG compass"}
                          </small>
                        </>
                      : <small>still layer</small>}
                  </td>
                  <td className={styles.summary}>
                    {row.summary}
                    <a href={row.viewerUrl} target="_blank" rel="noreferrer">Open in Codex ↗</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className={styles.guardrail}>
          <strong>Evidence guardrail:</strong> BANC is a wiring diagram, not a
          recording. Cell counts and synapse counts are measured from the
          materialized dataset named in each row. A synapse count is the number
          of distinct predicted synapses with one of that layer&apos;s cells at
          either end, inputs and outputs together, counted once even when both
          ends fall inside the layer. Some of these cells are very large: a
          single DNg100, also called BDN2, carries about 44,000 output synapses
          onto roughly 30,000 partners, which three independent synapse tables
          agree on. The animated sequences are
          explanatory, derived from skeleton geometry and synapse polarity, and
          are not recorded action potentials or measured conduction timing.
        </p>
      </section>
    </main>
  );
}

import type { Metadata } from "next";

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Citations & Credits — BANC Explorer",
  description:
    "Sources, cell types and the people behind BANC Explorer: Be the Fly.",
};

// Visual projection neurons of the optic lobe. These are the DETECTION side of
// the escape pathway and are deliberately kept distinct from the descending
// neurons that command the response: those produce an escape, they do not
// perform the detection. Counts are cells carrying that exact type label in
// BANC v888 cell_info, both hemispheres, and are annotation counts rather than
// a claim of completeness.
const DETECTION_CELLS = [
  {
    type: "LPLC2",
    count: 150,
    role: "Loom-selective",
    detail:
      "Selective for expanding, looming objects through radial motion opponency, and a major input to the giant-fibre escape pathway.",
    source: "Klapoetke et al., Nature 2017",
  },
  {
    type: "LC4",
    count: 99,
    role: "Angular velocity",
    detail:
      "Signals the angular speed of an approaching edge. LC4 and LPLC2 give the giant fibre complementary reads of a looming object, roughly speed alongside size.",
    source: "von Reyn et al., Nature Neuroscience 2017; Ache et al., Current Biology 2019",
  },
  {
    type: "LPLC1",
    count: 97,
    role: "Loom-responsive",
    detail:
      "Responds to expanding stimuli. Less fully characterised than LPLC2, and listed here for completeness rather than as an established escape trigger.",
    source: "Wu et al., eLife 2016",
  },
  {
    type: "LC6",
    count: 94,
    role: "Loom-responsive",
    detail:
      "Optogenetic activation drives escape-like behaviour, placing it in the looming-to-escape group.",
    source: "Wu et al., eLife 2016",
  },
  {
    type: "LC11",
    count: 121,
    role: "Small-object motion",
    detail:
      "Tuned to small moving objects rather than to expansion, so it reports a different visual feature than the looming types above.",
    source: "Keleş & Frye, Current Biology 2017; Wu et al., eLife 2016",
  },
  {
    type: "LC16",
    count: 177,
    role: "Expansion, avoidance",
    detail:
      "Responds to expanding dark stimuli, and its activation is associated with backward walking and avoidance turning rather than takeoff.",
    source: "Wu et al., eLife 2016",
  },
];

export default function CreditsPage() {
  return (
    <main className="credits-page">
      <nav className="credits-nav" aria-label="Credits navigation">
        <a className="brand" href={`${assetBase}/`}>
          <span className="brand-mark" aria-hidden="true">
            <img src={`${assetBase}/banc-explorer-fly-icon.svg`} alt="" />
          </span>
          <span>BANC / BE THE FLY</span>
        </a>
        <a className="credits-back" href={`${assetBase}/`}>BACK TO THE FLY ↗</a>
      </nav>

      <section className="credits-card">
        <p className="credits-kicker"><span /> BEHIND THE FLY</p>
        <h1>Citations &amp; Credits</h1>

        <figure className="credits-connectome-art">
          <div className="credits-connectome-frame">
            <img className="credits-connectome-context" src={`${assetBase}/banc-context-base.webp`} alt="" aria-hidden="true" />
            <img className="credits-connectome-action" src={`${assetBase}/banc-forward.webp`} alt="BANC neurons associated with forward walking, highlighted across the brain and ventral nerve cord" />
            <span className="credits-scanline" aria-hidden="true" />
          </div>
          <figcaption>BANC nervous system · forward-walking circuit highlighted</figcaption>
        </figure>

        <div className="credits-creator">
          <p>Created by</p>
          <h2>Amy Sterling</h2>
          <div className="credits-socials" aria-label="Amy Sterling links">
            <a href="https://x.com/amyneurons" target="_blank" rel="noreferrer">X · @amyneurons ↗</a>
            <a href="https://orcid.org/0000-0002-4961-3954" target="_blank" rel="noreferrer">ORCID · 0000-0002-4961-3954 ↗</a>
          </div>
        </div>

        <div className="credits-cells">
          <p>Seeing the threat</p>
          <h2>Visual projection neurons</h2>
          <p className="credits-cells-lede">
            A looming shadow is detected in the optic lobe, not by the descending
            neurons that command the escape. These lobula types carry that
            feature detection from the eye to the central brain. Counts are cells
            carrying each type label in BANC v888, across both hemispheres.
          </p>
          <ul>
            {DETECTION_CELLS.map((cell) => (
              <li key={cell.type}>
                <div className="credits-cell-head">
                  <strong>{cell.type}</strong>
                  <span className="credits-cell-count">{cell.count} cells</span>
                  <span className="credits-cell-role">{cell.role}</span>
                </div>
                <p>{cell.detail}</p>
                <small>{cell.source}</small>
              </li>
            ))}
          </ul>
          <p className="credits-cells-note">
            Detection and response are kept separate throughout this project. The
            descending neurons shown elsewhere in the experience produce an
            escape; they do not perform the detection.
          </p>
        </div>

        <div className="credits-sources">
          <p>Sources</p>
          <ul>
            <li>
              Bates, Phelps, Kim et al. Distributed control circuits across a
              brain-and-cord connectome. <em>Nature</em> (2026).
              <a href="https://doi.org/10.1038/s41586-026-10735-w" target="_blank" rel="noreferrer">doi:10.1038/s41586-026-10735-w ↗</a>
            </li>
            <li>
              Wu, Nern, Williamson et al. Visual projection neurons in the
              Drosophila lobula link feature detection to distinct behavioral
              programs. <em>eLife</em> (2016).
              <a href="https://doi.org/10.7554/eLife.21022" target="_blank" rel="noreferrer">doi:10.7554/eLife.21022 ↗</a>
            </li>
            <li>
              Klapoetke, Nern, Peek et al. Ultra-selective looming detection from
              radial motion opponency. <em>Nature</em> (2017).
              <a href="https://doi.org/10.1038/nature24626" target="_blank" rel="noreferrer">doi:10.1038/nature24626 ↗</a>
            </li>
            <li>
              von Reyn, Nern, Williamson et al. Feature integration drives
              probabilistic behavior in the Drosophila escape response.
              <em> Nature Neuroscience</em> (2017).
              <a href="https://doi.org/10.1038/nn.4581" target="_blank" rel="noreferrer">doi:10.1038/nn.4581 ↗</a>
            </li>
            <li>
              Ache, Polsky, Alghailani et al. Neural basis for looming size and
              velocity encoding in the Drosophila giant fiber escape pathway.
              <em> Current Biology</em> (2019).
              <a href="https://doi.org/10.1016/j.cub.2019.01.079" target="_blank" rel="noreferrer">doi:10.1016/j.cub.2019.01.079 ↗</a>
            </li>
            <li>
              Keleş &amp; Frye. Object-detecting neurons in Drosophila.
              <em> Current Biology</em> (2017).
              <a href="https://doi.org/10.1016/j.cub.2017.01.012" target="_blank" rel="noreferrer">doi:10.1016/j.cub.2017.01.012 ↗</a>
            </li>
          </ul>
          <p className="credits-cells-note">
            Structure suggests pathways; it does not record neural activity.
            Signal animations in this experience are explanatory, derived from
            skeleton geometry and synapse polarity, not measured conduction.
          </p>
        </div>

        <div className="credits-thanks">
          <p>With thanks to</p>
          <ul>
            <li><strong>Alexander Bates</strong><span>Harvard University</span></li>
            <li><strong>Yijie Yin</strong><span>University of Cambridge</span></li>
          </ul>
        </div>
      </section>
    </main>
  );
}

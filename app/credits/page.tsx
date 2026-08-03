import type { Metadata } from "next";

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Credits — BANC Explorer",
  description: "The people and research behind BANC Explorer: Be the Fly.",
};

type BehaviorReference = {
  index: string;
  action: string;
  cells: string;
  accent: "mint" | "pink" | "violet" | "gold";
  summary: string;
  sources: Array<{ title: string; year: string; href: string }>;
};

const behaviorReferences: BehaviorReference[] = [
  {
    index: "01",
    action: "Steer",
    cells: "DNa01",
    accent: "pink",
    summary: "A descending steering type whose left and right activity tracks same-side turning during locomotion.",
    sources: [
      { title: "Neural circuit mechanisms for steering control in walking Drosophila", year: "2020", href: "https://www.biorxiv.org/content/10.1101/2020.04.04.024703v4" },
      { title: "Fine-grained descending control of steering in walking Drosophila", year: "2023", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10614758/" },
      { title: "Imaging neural activity in the ventral nerve cord of behaving adult Drosophila", year: "2018", href: "https://www.nature.com/articles/s41467-018-06857-z" },
    ],
  },
  {
    index: "02",
    action: "Steer",
    cells: "DNa02",
    accent: "pink",
    summary: "A descending steering type studied from walking control through the transformation of navigational variables into turning.",
    sources: [
      { title: "Neural circuit mechanisms for steering control in walking Drosophila", year: "2020", href: "https://www.biorxiv.org/content/10.1101/2020.04.04.024703v4" },
      { title: "Fine-grained descending control of steering in walking Drosophila", year: "2023", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10614758/" },
      { title: "Hierarchical transformation of navigational variables into coordinated turning", year: "2024", href: "https://www.biorxiv.org/content/10.1101/2024.06.27.601106v1" },
    ],
  },
  {
    index: "03",
    action: "Walk + speed",
    cells: "DNg100",
    accent: "gold",
    summary: "Descending drive that can initiate forward walking; stronger activation increases stepping frequency and forward velocity.",
    sources: [
      { title: "Connectome simulations identify a central pattern generator circuit for fly walking", year: "2025", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC13142387/" },
    ],
  },
  {
    index: "04",
    action: "Moonwalk",
    cells: "MDN",
    accent: "violet",
    summary: "Moonwalker descending neurons reconfigure leg motor circuits to produce backward walking.",
    sources: [
      { title: "Distributed control of motor circuits for backward walking in Drosophila", year: "2020", href: "https://pubmed.ncbi.nlm.nih.gov/33268800/" },
      { title: "Imaging neural activity in the ventral nerve cord of behaving adult Drosophila", year: "2018", href: "https://www.nature.com/articles/s41467-018-06857-z" },
    ],
  },
  {
    index: "05",
    action: "Flight power",
    cells: "DNg02",
    accent: "mint",
    summary: "A population of descending neurons that regulates wingbeat amplitude across a wide dynamic range.",
    sources: [
      { title: "A population of descending neurons that regulate the flight motor of Drosophila", year: "2022", href: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9206711/" },
    ],
  },
  {
    index: "06",
    action: "Heading readout",
    cells: "EPG",
    accent: "violet",
    summary: "Compass neurons represent the fly’s allocentric heading. In the simulator they are a readout of turning—not the command that causes a turn.",
    sources: [
      { title: "Angular velocity integration in a fly heading circuit", year: "2017", href: "https://pubmed.ncbi.nlm.nih.gov/28530551/" },
      { title: "Sensorimotor experience remaps visual input to a heading-direction network", year: "2019", href: "https://pubmed.ncbi.nlm.nih.gov/31748749/" },
    ],
  },
  {
    index: "07",
    action: "Land",
    cells: "DNp07 + DNp10",
    accent: "gold",
    summary: "Multimodal descending neurons associated with visually guided landing responses and leg extension.",
    sources: [
      { title: "State-dependent decoupling of sensory and motor circuits underlies behavioral flexibility", year: "2019", href: "https://www.nature.com/articles/s41593-019-0413-4" },
    ],
  },
  {
    index: "08",
    action: "Freshen up",
    cells: "DNg12",
    accent: "mint",
    summary: "A descending population associated with anterior grooming and head-grooming programs.",
    sources: [
      { title: "Optogenetic dissection of descending behavioral control in Drosophila", year: "2018", href: "https://elifesciences.org/articles/34275" },
      { title: "Neural circuit mechanisms underlying context-specific halting in Drosophila", year: "2024", href: "https://www.nature.com/articles/s41586-024-07854-7" },
    ],
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
        <header className="credits-intro">
          <p className="credits-kicker"><span /> BEHIND THE FLY</p>
          <h1>Credits</h1>
          <p>Built from a whole-nervous-system connectome—and from the experiments that connect individual cells to behavior.</p>
        </header>

        <figure className="credits-connectome-art">
          <div className="credits-connectome-frame">
            <img className="credits-connectome-context" src={`${assetBase}/banc-context-base.webp`} alt="" aria-hidden="true" />
            <img className="credits-connectome-action" src={`${assetBase}/banc-forward.webp`} alt="BANC neurons associated with forward walking, highlighted across the brain and ventral nerve cord" />
            <span className="credits-scanline" aria-hidden="true" />
            <span className="credits-image-readout" aria-hidden="true">BANC · CNS 001</span>
          </div>
          <figcaption>BANC nervous system · forward-walking circuit highlighted</figcaption>
        </figure>

        <div className="credits-people-grid">
          <div className="credits-creator">
            <p>Created by</p>
            <h2>Amy Sterling</h2>
            <div className="credits-socials" aria-label="Amy Sterling links">
              <a href="https://x.com/amyneurons" target="_blank" rel="noreferrer">X · @amyneurons ↗</a>
              <a href="https://orcid.org/0000-0002-4961-3954" target="_blank" rel="noreferrer">ORCID · 0000-0002-4961-3954 ↗</a>
            </div>
          </div>

          <div className="credits-thanks">
            <p>With thanks to</p>
            <ul>
              <li><strong>Alexander Bates</strong><span>Harvard University</span></li>
              <li><strong>Yijie Yin</strong><span>University of Cambridge</span></li>
            </ul>
          </div>
        </div>

        <section className="credits-reference-console" aria-labelledby="behavior-references-title">
          <header className="credits-reference-header">
            <div>
              <p><i /> REFERENCE CONSOLE</p>
              <h2 id="behavior-references-title">Neurons behind the moves</h2>
            </div>
            <span>08 BEHAVIORS · PRIMARY SOURCES</span>
          </header>

          <div className="credits-reference-grid">
            {behaviorReferences.map((reference) => (
              <article className={`credits-reference-item accent-${reference.accent}`} key={`${reference.cells}-${reference.index}`}>
                <header>
                  <span>{reference.index}</span>
                  <div>
                    <p>{reference.action}</p>
                    <h3>{reference.cells}</h3>
                  </div>
                </header>
                <p className="credits-reference-summary">{reference.summary}</p>
                <ol>
                  {reference.sources.map((source, sourceIndex) => (
                    <li key={source.href}>
                      <a href={source.href} target="_blank" rel="noreferrer">
                        <span>[{String(sourceIndex + 1).padStart(2, "0")}]</span>
                        <strong>{source.title}</strong>
                        <small>{source.year} ↗</small>
                      </a>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>

          <footer className="credits-reference-note">
            <strong>HOW TO READ THIS</strong>
            <p>These papers support the cell–behavior relationships shown here. The glowing selections and signal sweeps in Be the Fly are explanatory animations—not recordings of neural activity or measured conduction timing.</p>
          </footer>
        </section>
      </section>
    </main>
  );
}

import type { Metadata } from "next";

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Credits — BANC Explorer",
  description: "The people behind BANC Explorer: Be the Fly.",
};

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
        <h1>Credits</h1>

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

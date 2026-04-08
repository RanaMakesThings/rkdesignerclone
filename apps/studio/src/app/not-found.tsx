import Link from "next/link";

export default function NotFound() {
  return (
    <div className="studio-not-found page-enter">
      <section className="studio-not-found-panel">
        <div className="hero-copy">
          <p className="eyebrow">Designer Studio</p>
          <h1>The requested slide view does not exist.</h1>
          <p className="hero-text">
            The route did not resolve to a reviewable Designer slide root in the current deck state.
          </p>
          <Link href="/" className="primary-link">
            Back To Selected Slides
          </Link>
        </div>
      </section>
    </div>
  );
}

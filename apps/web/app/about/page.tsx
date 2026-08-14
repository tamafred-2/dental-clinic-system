import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { apiFetch, fallbackClinic, type Clinic } from "../../lib/api";

export const metadata: Metadata = { title: "About | Dental Clinic Website" };

export default async function AboutPage() {
  const clinic = await apiFetch<Clinic>("/clinic", fallbackClinic);
  return (
    <>
      <SiteHeader />
      <main>
        <header className="page-hero shell">
          <p className="eyebrow">About the clinic</p>
          <h1>A local practice built around clear, considerate care.</h1>
          <p className="lead">
            This demo presents a practical vision for a welcoming dental clinic
            in Calasiao—professional without feeling impersonal.
          </p>
        </header>
        <section className="section shell about-story">
          <div className="image-frame about-photo">
            <Image
              src="/images/image-placeholder.jpg"
              alt="Temporary clinic interior placeholder"
              fill
              sizes="(max-width: 800px) 100vw, 48vw"
            />
          </div>
          <div>
            <p className="eyebrow">Our approach</p>
            <h2>Patients should understand their care.</h2>
            <p>
              Good dentistry is not only about treatment. It is also about
              listening carefully, explaining options in plain language, and
              giving people enough information to make confident decisions.
            </p>
            <p>
              The future clinic can replace this copy with its real history,
              values, facilities, and credentials.
            </p>
            <Link className="text-link" href="/dentists">
              Meet the care team
            </Link>
          </div>
        </section>
        <section className="section section-tint">
          <div className="shell values-grid">
            <article>
              <span>01</span>
              <h2>Listen first</h2>
              <p>
                Each concern deserves attention before a treatment plan is
                proposed.
              </p>
            </article>
            <article>
              <span>02</span>
              <h2>Explain clearly</h2>
              <p>
                Patients should understand recommendations, timing, and next
                steps.
              </p>
            </article>
            <article>
              <span>03</span>
              <h2>Treat thoughtfully</h2>
              <p>
                Comfort, safety, and long-term oral health guide every visit.
              </p>
            </article>
          </div>
        </section>
        <section className="section shell center-cta">
          <h2>Visit us in Calasiao.</h2>
          <p>{clinic.address}</p>
          <Link className="button button-primary" href="/contact">
            Contact the clinic
          </Link>
        </section>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

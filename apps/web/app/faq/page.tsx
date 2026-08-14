import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import {
  apiFetch,
  fallbackClinic,
  fallbackFaqs,
  type Clinic,
  type Faq,
} from "../../lib/api";

export const metadata: Metadata = {
  title: "Frequently Asked Questions | Dental Clinic Website",
  description:
    "Answers to common questions about appointments, dental visits, and clinic services.",
};

export default async function FaqPage() {
  const [clinic, faqs] = await Promise.all([
    apiFetch<Clinic>("/clinic", fallbackClinic),
    apiFetch<Faq[]>("/faqs", fallbackFaqs),
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <header className="page-hero shell">
          <p className="eyebrow">Frequently asked questions</p>
          <h1>Helpful answers before your visit.</h1>
          <p className="lead">
            Clear information about appointments, treatments, and what to expect
            at the clinic.
          </p>
        </header>

        <section className="section shell faq-page-layout">
          <aside>
            <p className="overline">Still have a question?</p>
            <h2>Talk with the clinic.</h2>
            <p>
              The team can help with questions that depend on your individual
              visit or treatment plan.
            </p>
            <Link className="button button-primary" href="/contact">
              Contact the clinic
            </Link>
          </aside>
          <div className="faq-list faq-list-large">
            {faqs.map((faq, index) => (
              <details key={faq.id} open={index === 0}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

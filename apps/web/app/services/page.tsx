import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import {
  apiFetch,
  fallbackClinic,
  fallbackServices,
  type Clinic,
  type DentalService,
} from "../../lib/api";

export const metadata: Metadata = {
  title: "Dental Services | Dental Clinic Website",
};

export default async function ServicesPage() {
  const [clinic, services] = await Promise.all([
    apiFetch<Clinic>("/clinic", fallbackClinic),
    apiFetch<DentalService[]>("/services", fallbackServices),
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <header className="page-hero shell">
          <p className="eyebrow">Treatments and services</p>
          <h1>Care for healthy, confident smiles.</h1>
          <p className="lead">
            From preventive visits to focused treatment, each service starts
            with a clear conversation about what you need.
          </p>
        </header>
        <section
          className="section shell service-list"
          aria-label="Dental services"
        >
          {services.map((service, index) => (
            <article key={service.id}>
              <span className="item-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{service.name}</h2>
                <p>{service.description}</p>
              </div>
              <div className="service-meta">
                <span>Typical visit</span>
                <strong>{service.durationMinutes} min</strong>
                <Link href="/appointments">Request this service</Link>
              </div>
            </article>
          ))}
        </section>
        <section className="section shell">
          <div className="notice">
            <div>
              <h2>Not sure what to book?</h2>
              <p>
                Start with a dental consultation. The clinic can assess your
                needs and explain the suitable next step.
              </p>
            </div>
            <Link className="button button-primary" href="/appointments">
              Book a consultation
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

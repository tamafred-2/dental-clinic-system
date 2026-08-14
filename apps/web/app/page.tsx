import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import {
  apiFetch,
  fallbackClinic,
  fallbackDentists,
  fallbackFaqs,
  fallbackServices,
  phoneHref,
  type Clinic,
  type DentalService,
  type Dentist,
  type Faq,
} from "../lib/api";

export default async function Home() {
  const [clinic, services, dentists, faqs] = await Promise.all([
    apiFetch<Clinic>("/clinic", fallbackClinic),
    apiFetch<DentalService[]>("/services", fallbackServices),
    apiFetch<Dentist[]>("/dentists", fallbackDentists),
    apiFetch<Faq[]>("/faqs", fallbackFaqs),
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero shell">
          <div className="hero-copy">
            <p className="clinic-name">{clinic.name}</p>
            <p className="eyebrow">Dental care in Calasiao</p>
            <h1>Good dental care should feel straightforward.</h1>
            <p className="lead">
              Clear advice, considerate treatment, and a team that takes time to
              listen—so every visit feels more comfortable from the start.
            </p>
            <div className="button-row">
              <Link className="button button-primary" href="/appointments">
                Request an appointment
              </Link>
              <a
                className="button button-secondary"
                href={phoneHref(clinic.phone)}
              >
                Call {clinic.phone}
              </a>
            </div>
            <ul className="check-list" aria-label="Clinic benefits">
              <li>Family-friendly care</li>
              <li>Clear treatment plans</li>
              <li>Convenient local clinic</li>
            </ul>
          </div>

          <div className="hero-media">
            <div className="image-frame hero-photo">
              <Image
                src="/images/image-placeholder.jpg"
                alt="Temporary clinic photo placeholder"
                fill
                priority
                sizes="(max-width: 800px) 100vw, 46vw"
              />
            </div>
            <aside className="visit-card">
              <p className="overline">Plan your visit</p>
              <p className="visit-hours">{clinic.openingHours}</p>
              <p>{clinic.address}</p>
              <Link href="/contact">Directions and contact details</Link>
            </aside>
          </div>
        </section>

        <section className="trust-strip" aria-label="Clinic approach">
          <div className="shell trust-grid">
            <p>
              <strong>Local care</strong>
              <span>Serving Calasiao and nearby communities</span>
            </p>
            <p>
              <strong>Thoughtful visits</strong>
              <span>Time to ask questions and understand options</span>
            </p>
            <p>
              <strong>Practical planning</strong>
              <span>Appointment times shown in Asia/Manila</span>
            </p>
          </div>
        </section>

        <section className="section shell faq-feature">
          <div className="faq-intro">
            <p className="eyebrow">Before your visit</p>
            <h2>Questions patients often ask.</h2>
            <p>
              Find quick, practical information about appointments, visits, and
              common clinic procedures.
            </p>
            <Link className="text-link" href="/faq">
              View all questions
            </Link>
          </div>
          <div className="faq-list">
            {faqs.slice(0, 4).map((faq, index) => (
              <details key={faq.id} open={index === 0}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section shell">
          <div className="section-intro split-heading">
            <div>
              <p className="eyebrow">How we can help</p>
              <h2>Everyday care and specialist treatment.</h2>
            </div>
            <div>
              <p>
                Explore common treatments below, or view the full service list
                for appointment lengths and details.
              </p>
              <Link className="text-link" href="/services">
                See all services
              </Link>
            </div>
          </div>
          <div className="service-preview-grid">
            {services.slice(0, 3).map((service, index) => (
              <article className="service-preview" key={service.id}>
                <span className="item-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3>{service.name}</h3>
                <p>{service.description}</p>
                <span className="duration">
                  About {service.durationMinutes} minutes
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-tint">
          <div className="shell team-feature">
            <div>
              <p className="eyebrow">Your care team</p>
              <h2>Experienced people, a calm approach.</h2>
              <p className="lead-small">
                Our dentists bring different areas of experience together,
                helping patients receive the right care without losing the
                personal touch.
              </p>
              <Link className="button button-secondary" href="/dentists">
                Meet all dentists
              </Link>
            </div>
            <div className="team-list">
              {dentists.slice(0, 3).map((dentist) => (
                <article key={dentist.id}>
                  <span className="initials" aria-hidden="true">
                    {dentist.name
                      .replace("Dr. ", "")
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div>
                    <h3>{dentist.name}</h3>
                    <p>{dentist.title}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section shell">
          <div className="appointment-banner">
            <div>
              <p className="eyebrow light-eyebrow">Ready when you are</p>
              <h2>Let’s plan your next visit.</h2>
              <p>
                Send an appointment request and the clinic can confirm the best
                available time.
              </p>
            </div>
            <Link className="button button-light" href="/appointments">
              Request an appointment
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

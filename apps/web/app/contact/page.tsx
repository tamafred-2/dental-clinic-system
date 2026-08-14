import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import {
  apiFetch,
  fallbackClinic,
  phoneHref,
  type Clinic,
} from "../../lib/api";

export const metadata: Metadata = { title: "Contact | Dental Clinic Website" };

export default async function ContactPage() {
  const clinic = await apiFetch<Clinic>("/clinic", fallbackClinic);
  const mapQuery = encodeURIComponent(clinic.address);
  return (
    <>
      <SiteHeader />
      <main>
        <header className="page-hero page-hero-compact shell">
          <p className="eyebrow">Contact and location</p>
          <h1>We’re here to help.</h1>
          <p className="lead">
            Call or email for questions, directions, or help choosing the right
            appointment.
          </p>
        </header>
        <section className="section shell contact-layout">
          <div className="contact-panel">
            <div>
              <p className="overline">Call</p>
              <a className="contact-value" href={phoneHref(clinic.phone)}>
                {clinic.phone}
              </a>
              <p>For appointments, urgent concerns, and general questions.</p>
            </div>
            <div>
              <p className="overline">Email</p>
              <a className="contact-value" href={`mailto:${clinic.email}`}>
                {clinic.email}
              </a>
              <p>We aim to respond during regular clinic hours.</p>
            </div>
            <div>
              <p className="overline">Clinic hours</p>
              <p className="contact-value">{clinic.openingHours}</p>
              <p>Times are shown in {clinic.timeZone}.</p>
            </div>
          </div>
          <div className="location-card">
            <div className="map-placeholder">
              <span>Map location</span>
              <strong>Calasiao, Pangasinan</strong>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
            </div>
            <div>
              <p className="overline">Address</p>
              <h2>{clinic.address}</h2>
              <p>
                Please confirm the full street address with the clinic before
                your first visit. This is currently demo information.
              </p>
            </div>
          </div>
        </section>
        <section className="section section-tint">
          <div className="shell policy-grid">
            <article>
              <p className="eyebrow">Before your visit</p>
              <h2>Appointment policy</h2>
              <p>{clinic.appointmentPolicy}</p>
            </article>
            <article>
              <p className="eyebrow">Plans change</p>
              <h2>Cancellation policy</h2>
              <p>{clinic.cancellationPolicy}</p>
            </article>
          </div>
        </section>
        <section className="section shell center-cta">
          <h2>Want to request a time?</h2>
          <p>
            Use the appointment page to review the process before contacting the
            clinic.
          </p>
          <Link className="button button-primary" href="/appointments">
            Go to appointments
          </Link>
        </section>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

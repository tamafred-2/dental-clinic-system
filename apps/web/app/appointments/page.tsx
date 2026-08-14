import type { Metadata } from "next";
import { AppointmentForm } from "../../components/appointment-form";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import {
  apiFetchOptional,
  fallbackClinic,
  phoneHref,
  type Clinic,
  type DentalService,
  type Dentist,
} from "../../lib/api";

export const metadata: Metadata = {
  title: "Request an Appointment | Dental Clinic Website",
  description:
    "Choose a dental service, dentist, date, and available time to send an appointment request.",
};

function dateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export default async function AppointmentsPage() {
  const [liveClinic, liveServices, liveDentists] = await Promise.all([
    apiFetchOptional<Clinic>("/clinic"),
    apiFetchOptional<DentalService[]>("/services"),
    apiFetchOptional<Dentist[]>("/dentists"),
  ]);
  const clinic = liveClinic ?? fallbackClinic;
  const bookingData =
    liveClinic && liveServices?.length && liveDentists?.length
      ? {
          clinic: liveClinic,
          services: liveServices,
          dentists: liveDentists,
        }
      : null;
  const currentDate = new Date();
  const minimumDate = dateInTimeZone(currentDate, clinic.timeZone);
  const maximumDate = dateInTimeZone(
    new Date(currentDate.getTime() + 179 * 24 * 60 * 60 * 1000),
    clinic.timeZone,
  );

  return (
    <>
      <SiteHeader />
      <main>
        <header className="page-hero shell appointment-page-hero">
          <p className="eyebrow">Appointment requests</p>
          <h1>Choose a time that works for you.</h1>
          <p className="lead">
            Select from the clinic’s live availability and send the details
            needed to request your visit. The clinic will confirm the final
            appointment separately.
          </p>
        </header>

        <section className="section shell booking-layout">
          {bookingData ? (
            <AppointmentForm
              services={bookingData.services}
              dentists={bookingData.dentists}
              timeZone={bookingData.clinic.timeZone}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
          ) : (
            <section className="booking-unavailable" role="status">
              <p className="eyebrow">Online requests unavailable</p>
              <h2>Please call the clinic to request an appointment.</h2>
              <p>
                The live schedule could not be loaded, so the website will not
                offer placeholder times or submit an unreliable request.
              </p>
              <a
                className="button button-primary"
                href={phoneHref(clinic.phone)}
              >
                Call {clinic.phone}
              </a>
            </section>
          )}

          <aside className="booking-sidebar">
            <div>
              <p className="overline">Before you send</p>
              <h2>Good to know.</h2>
              <p>{clinic.appointmentPolicy}</p>
            </div>
            <div>
              <h3>Need help booking?</h3>
              <p>
                Call the clinic if you cannot find a suitable time or are unsure
                which service to select.
              </p>
              <a className="text-link" href={phoneHref(clinic.phone)}>
                Call {clinic.phone}
              </a>
            </div>
            <div className="urgent-note">
              <h3>Urgent dental concern?</h3>
              <p>
                Call the clinic directly. For a life-threatening emergency,
                contact local emergency services instead of using this form.
              </p>
            </div>
          </aside>
        </section>

        <section className="section section-tint">
          <div className="shell appointment-steps">
            <div>
              <p className="eyebrow">What happens next</p>
              <h2>A request is the first step.</h2>
            </div>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <h3>Request received</h3>
                  <p>
                    Your selected time is saved as a pending appointment
                    request.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Clinic review</h3>
                  <p>
                    The team reviews the request and contacts you if anything
                    needs clarification.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Final confirmation</h3>
                  <p>
                    The visit is confirmed only after you receive confirmation
                    from the clinic.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

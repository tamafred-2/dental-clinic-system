import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import {
  apiFetch,
  fallbackClinic,
  fallbackDentists,
  type Clinic,
  type Dentist,
} from "../../lib/api";

export const metadata: Metadata = {
  title: "Our Dentists | Dental Clinic Website",
};

export default async function DentistsPage() {
  const [clinic, dentists] = await Promise.all([
    apiFetch<Clinic>("/clinic", fallbackClinic),
    apiFetch<Dentist[]>("/dentists", fallbackDentists),
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <header className="page-hero shell">
          <p className="eyebrow">Meet the team</p>
          <h1>Professional care, delivered personally.</h1>
          <p className="lead">
            A multidisciplinary team with one shared goal: helping every patient
            feel informed and at ease.
          </p>
        </header>
        <section className="section shell dentist-grid">
          {dentists.map((dentist) => (
            <article className="dentist-profile" key={dentist.id}>
              <div className="image-frame profile-photo">
                <Image
                  src={dentist.photoUrl || "/images/image-placeholder.jpg"}
                  alt={
                    dentist.photoUrl
                      ? `${dentist.name}, ${dentist.title}`
                      : `Temporary portrait placeholder for ${dentist.name}`
                  }
                  fill
                  sizes="(max-width: 700px) 100vw, 33vw"
                />
              </div>
              <div className="profile-body">
                <p className="overline">{dentist.title}</p>
                <h2>{dentist.name}</h2>
                <p>
                  {dentist.bio ||
                    "Committed to clear communication, careful treatment, and a comfortable patient experience."}
                </p>
                <ul className="tag-list">
                  {dentist.specializations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <Link className="text-link" href="/appointments">
                  Request an appointment
                </Link>
              </div>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

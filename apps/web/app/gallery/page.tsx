import type { Metadata } from "next";
import Image from "next/image";
import { SiteFooter } from "../../components/site-footer";
import { SiteHeader } from "../../components/site-header";
import { apiFetch, fallbackClinic, type Clinic } from "../../lib/api";

export const metadata: Metadata = {
  title: "Smile Gallery | Dental Clinic Website",
};

const galleryItems = [
  {
    title: "Preventive care",
    description: "A future space for clinic-approved treatment photography.",
  },
  {
    title: "Restorative dentistry",
    description:
      "Before-and-after cases may be shared here with written patient consent.",
  },
  {
    title: "Smile improvement",
    description:
      "A considered record of real treatment outcomes—not stock results.",
  },
  {
    title: "The clinic",
    description:
      "Photos of the reception, treatment rooms, and clinic facilities.",
  },
  {
    title: "Our team",
    description:
      "Natural portraits of the people patients will meet during a visit.",
  },
  {
    title: "Patient education",
    description:
      "Useful visual explanations for common treatments and aftercare.",
  },
];

export default async function GalleryPage() {
  const clinic = await apiFetch<Clinic>("/clinic", fallbackClinic);
  return (
    <>
      <SiteHeader />
      <main>
        <header className="page-hero shell">
          <p className="eyebrow">Gallery</p>
          <h1>A place for real clinic stories.</h1>
          <p className="lead">
            This demo uses one neutral placeholder. A future clinic can replace
            these with approved facility, team, and treatment images.
          </p>
        </header>
        <section className="section shell gallery-grid">
          {galleryItems.map((item, index) => (
            <figure
              className={
                index === 0 || index === 3
                  ? "gallery-item gallery-wide"
                  : "gallery-item"
              }
              key={item.title}
            >
              <div className="image-frame gallery-photo">
                <Image
                  src="/images/image-placeholder.jpg"
                  alt="Temporary image placeholder"
                  fill
                  sizes="(max-width: 700px) 100vw, 50vw"
                />
              </div>
              <figcaption>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </section>
        <div className="shell consent-note">
          <strong>Patient privacy comes first.</strong>
          <p>
            No patient photo should be published without clear written consent
            and an agreed explanation of how it will be used.
          </p>
        </div>
      </main>
      <SiteFooter clinic={clinic} />
    </>
  );
}

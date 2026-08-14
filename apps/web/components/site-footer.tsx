import Link from "next/link";
import type { Clinic } from "../lib/api";
import { phoneHref } from "../lib/api";

export function SiteFooter({ clinic }: { clinic: Clinic }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <p className="footer-title">{clinic.name}</p>
          <p>Thoughtful dental care for Calasiao and nearby communities.</p>
        </div>
        <div>
          <p className="footer-heading">Visit</p>
          <p>{clinic.address}</p>
          <p>{clinic.openingHours}</p>
        </div>
        <div>
          <p className="footer-heading">Contact</p>
          <a href={phoneHref(clinic.phone)}>{clinic.phone}</a>
          <a href={`mailto:${clinic.email}`}>{clinic.email}</a>
        </div>
        <div>
          <p className="footer-heading">Explore</p>
          <Link href="/services">Services</Link>
          <Link href="/dentists">Our dentists</Link>
          <Link href="/faq">Frequently asked questions</Link>
          <Link href="/appointments">Appointments</Link>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} {clinic.name}
        </span>
        <span>Demo website for a future clinic client</span>
      </div>
    </footer>
  );
}

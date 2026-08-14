import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

const navigation = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/dentists", label: "Dentists" },
  { href: "/faq", label: "FAQ" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link
          className="brand"
          href="/"
          aria-label="Dental Clinic Website home"
        >
          <span className="brand-symbol" aria-hidden="true">
            DC
          </span>
          <span>
            <strong>Dental Clinic</strong>
            <small>Calasiao, Pangasinan</small>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
          <Link
            className="button button-small button-primary"
            href="/appointments"
          >
            Book a visit
          </Link>
        </nav>

        <details className="mobile-menu">
          <summary>
            <span className="menu-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="sr-only">Open navigation menu</span>
          </summary>
          <nav aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
            <ThemeToggle />
            <Link className="button button-primary" href="/appointments">
              Book a visit
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

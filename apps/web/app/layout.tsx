import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dental Clinic Website",
  description:
    "Comfortable, patient-focused dental care in Calasiao, Pangasinan.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var key="dental-clinic-theme";var saved=localStorage.getItem(key);var theme=saved==="dark"||saved==="light"?saved:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.dataset.theme=theme;}catch(error){document.documentElement.dataset.theme="light";}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

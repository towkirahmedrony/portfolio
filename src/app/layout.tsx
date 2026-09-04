import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Instrument_Sans, Newsreader } from "next/font/google";
import { PublicChrome } from "@/components/public-chrome";
import { site } from "@/data/site";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-sans-family",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-display-family",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.setAttribute("data-theme","dark")}else{document.documentElement.setAttribute("data-theme","light")}}catch(e){}})()`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.role}`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  openGraph: {
    title: `${site.name} — ${site.role}`,
    description: site.description,
    url: site.url,
    siteName: site.name,
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — ${site.role}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${instrumentSans.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <PublicChrome>{children}</PublicChrome>
      </body>
    </html>
  );
}

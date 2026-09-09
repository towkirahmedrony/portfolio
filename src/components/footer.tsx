import Link from "next/link";
import { navigation, site, socialLinks } from "@/data/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-card-border">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-lg tracking-tight">{site.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            {site.role}. I plan, design, and ship websites and custom web
            applications — from first conversation to launch.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            Navigation
          </p>
          <ul className="mt-4 space-y-2.5">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm text-foreground/85 transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
            Connect
          </p>
          <ul className="mt-4 space-y-2.5">
            <li>
              <a
                href={`mailto:${site.email}`}
                className="rounded-sm text-sm text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Send me an email"
              >
                Email Me
              </a>
            </li>
            <li>
              <a
                href={`https://wa.me/${site.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Chat with me on WhatsApp (opens in a new tab)"
                className="rounded-sm text-sm text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <Link
                href="/start-project"
                className="text-sm text-foreground/85 transition-colors hover:text-foreground"
              >
                Start a Project
              </Link>
            </li>
            {socialLinks.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground/85 transition-colors hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-card-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            &copy; {year} {site.name}. All rights reserved.
          </p>
          <p>{site.location}</p>
        </div>
      </div>
    </footer>
  );
}

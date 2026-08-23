"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";
import { fill, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";

// The partner's own link, the QR code for it, and the four ways to send it.
//
// EVERY SHARE TARGET IS A PLAIN URL. wa.me and the X intent are ordinary
// links, the mail button is a mailto:, and Instagram gets the message on the
// clipboard because it has no share URL at all. No SDK, no pixel, nothing
// that would load a third party's script onto a page that shows somebody's
// earnings.

interface Props {
  link: string;
  code: string;
  /** SVG markup for the link's QR code, rendered by the server. */
  qrSvg: string;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API needs a secure context and a permission the browser may
    // refuse. The old selection trick still works where it does not, and a
    // partner on an older phone should not be left retyping a link by hand.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function LinkBlock({ link, code, qrSvg }: Props) {
  const t = useT();
  const [done, setDone] = useState<"link" | "text" | null>(null);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => setDone(null), 2000);
    return () => window.clearTimeout(timer);
  }, [done]);

  const message = fill(t.partner.dash.shareMessage, { link });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
  const mail = `mailto:?subject=${encodeURIComponent(t.partner.dash.shareSubject)}&body=${encodeURIComponent(message)}`;

  const shares: Array<{ label: string; href?: string; icon: typeof Mail; onClick?: () => void }> = [
    { label: t.partner.dash.shareWhatsapp, href: whatsapp, icon: MessageCircle },
    { label: t.partner.dash.shareX, href: x, icon: Share2 },
    { label: t.partner.dash.shareMail, href: mail, icon: Mail },
    {
      label: done === "text" ? t.partner.dash.copied : t.partner.dash.shareCopyText,
      icon: done === "text" ? Check : Copy,
      onClick: () => {
        void copy(message).then((ok) => ok && setDone("text"));
      },
    },
  ];

  return (
    <section className="border-t border-[var(--color-hairline)] pt-6">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]">
        {t.partner.dash.linkTitle}
      </h2>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--color-ink-secondary)]">
        {t.partner.dash.linkSub}
      </p>

      {/* The link is a CONTROL — it gets the thin outline, the surrounding
          page does not. */}
      <div className="mt-4 flex items-stretch gap-2">
        <p className="min-w-0 flex-1 overflow-x-auto rounded-[var(--r-control)] border border-white/[0.08] bg-white/[0.02] px-3.5 py-3 font-mono text-[13px] leading-tight text-[var(--color-ink)] [scrollbar-width:none] sm:text-[15px]">
          <span className="whitespace-nowrap">{link}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            void copy(link).then((ok) => ok && setDone("link"));
          }}
          className={cn(
            "interactive flex shrink-0 items-center gap-1.5 rounded-[var(--r-control)] px-4 text-[12.5px] font-bold uppercase tracking-[0.05em] transition-colors",
            done === "link"
              ? "bg-[var(--color-accent-deep)] text-[var(--color-accent)]"
              : "bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-bright)]",
          )}
        >
          {done === "link" ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          <span className="hidden sm:inline">
            {done === "link" ? t.partner.dash.copied : t.partner.dash.copy}
          </span>
        </button>
      </div>

      <p className="mt-2 text-[11.5px] text-[var(--color-ink-tertiary)]">
        {t.partner.dash.codeLabel}:{" "}
        <span className="font-mono tracking-[0.12em] text-[var(--color-ink-secondary)]">{code}</span>
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {shares.map((s) => {
          const inner = (
            <>
              <s.icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" aria-hidden />
              {s.label}
            </>
          );
          return (
            <li key={s.label}>
              {s.href ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="interactive flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:border-white/20"
                >
                  {inner}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={s.onClick}
                  className="interactive flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-[12px] font-medium text-[var(--color-ink-secondary)] hover:border-white/20"
                >
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {qrSvg ? (
        <div className="mt-5 flex items-center gap-4">
          {/*
            WHY THIS IS dangerouslySetInnerHTML, AND WHY IT IS SAFE HERE
            The markup is not user input: /api/affiliate/me renders it on the
            server with the `qrcode` package from the partner's own link, and
            the link is built from a code out of our own alphabet. Nothing a
            customer types reaches this string. It is inserted as markup
            rather than as an <img src="data:…"> so it stays a vector at any
            size and needs no second request.

            The white plate is deliberate: a QR code is read by contrast, and
            dark modules on a dark surface do not scan. This is the one place
            in the app where a white fill is a function, not a decision.

            AND THE MODULES ARE RE-COLOURED HERE, WHICH IS NOT COSMETIC. The
            route renders the code with white modules on a transparent
            ground — correct for dropping onto a dark page, invisible on this
            plate. A CSS `stroke` beats the SVG's presentation attribute, so
            the pair below fixes the contrast on this side no matter which
            colour the server picks, instead of leaving a blank white square
            the day somebody changes it back. Inverted codes (light modules
            on dark) are decoded by some readers and not others; the standard
            orientation is the one that scans everywhere.
          */}
          <div
            className="h-[124px] w-[124px] shrink-0 rounded-2xl bg-white p-2 [&>svg]:h-full [&>svg]:w-full [&_path]:stroke-[#05080d] [&_rect]:fill-white"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--color-ink)]">
              {t.partner.dash.qrTitle}
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-ink-tertiary)]">
              {t.partner.dash.qrHint}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

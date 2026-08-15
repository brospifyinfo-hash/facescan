"use client";

/**
 * Payment-method marks shown under the pay button.
 *
 * Drawn as neutral monochrome glyphs rather than the brands' official
 * colour logos: reproducing those requires following each scheme's brand
 * guidelines, and a wrong-coloured Visa mark is worse than none. These read
 * as "these methods work here" without misusing anyone's trademark.
 *
 * Only render marks for methods actually enabled in the Stripe dashboard —
 * showing a method that then fails to appear is its own trust problem.
 */

const cls = "h-[18px] w-auto text-[var(--color-ink-tertiary)] transition-colors";

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      className="flex h-6 items-center rounded-[5px] border border-white/[0.09] bg-white/[0.03] px-1.5"
      title={label}
      aria-label={label}
      role="img"
    >
      {children}
    </span>
  );
}

function Word({ children, label }: { children: string; label: string }) {
  return (
    <Frame label={label}>
      <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-ink-tertiary)]">
        {children}
      </span>
    </Frame>
  );
}

/**
 * The methods shown when the caller does not narrow the list.
 *
 * Kept as one exported constant so the marks under the package list and the
 * marks under the pay button cannot drift apart — a customer who picks a
 * plan because PayPal was shown, and then does not find PayPal at checkout,
 * has been misled by a detail nobody would think to test.
 */
export const DEFAULT_METHODS = [
  "apple_pay",
  "google_pay",
  "paypal",
  "klarna",
  "visa",
  "mastercard",
  "amex",
] as const;

export function PaymentIcons({ methods }: { methods?: readonly string[] }) {
  const show = (m: string) => !methods || methods.includes(m);

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {show("visa") ? <Word label="Visa">Visa</Word> : null}

      {show("mastercard") ? (
        <Frame label="Mastercard">
          <svg viewBox="0 0 32 20" className={cls} fill="none" aria-hidden>
            <circle cx="13" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="19" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </Frame>
      ) : null}

      {show("amex") ? <Word label="American Express">Amex</Word> : null}

      {show("card") ? (
        <Frame label="Kredit- und Debitkarte">
          <svg viewBox="0 0 32 20" className={cls} fill="none" aria-hidden>
            <rect x="0.6" y="0.6" width="30.8" height="18.8" rx="2.6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1 6.4h30" stroke="currentColor" strokeWidth="1.8" />
            <rect x="4" y="11" width="7" height="1.6" rx="0.8" fill="currentColor" />
          </svg>
        </Frame>
      ) : null}

      {show("apple_pay") ? (
        <Frame label="Apple Pay">
          <svg viewBox="0 0 40 20" className={cls} fill="currentColor" aria-hidden>
            <path d="M9.6 5.2c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.7 2.2.8.05 1.6-.4 2.1-1.1Zm.7 1.2c-1.2-.07-2.2.65-2.7.65-.56 0-1.4-.62-2.3-.6-1.2.02-2.3.7-2.9 1.76-1.24 2.15-.32 5.32.88 7.06.6.85 1.3 1.8 2.2 1.77.9-.03 1.2-.57 2.3-.57s1.35.57 2.3.55c.95-.02 1.55-.86 2.13-1.72.67-.98.95-1.93.96-1.98-.02-.02-1.84-.71-1.86-2.8-.02-1.75 1.43-2.59 1.5-2.63-.82-1.2-2.1-1.34-2.55-1.37Z" />
            <text x="16" y="14.5" fontSize="9.5" fontFamily="ui-sans-serif, system-ui" fontWeight="500">Pay</text>
          </svg>
        </Frame>
      ) : null}

      {show("google_pay") ? (
        <Frame label="Google Pay">
          <svg viewBox="0 0 44 20" className={cls} fill="currentColor" aria-hidden>
            <path d="M9.9 10.2v3.6H8.6V4.9h3.1c.78 0 1.45.26 1.99.78.55.52.83 1.16.83 1.9 0 .77-.28 1.4-.83 1.92-.53.51-1.2.77-1.99.77H9.9Zm0-4.06v2.83h1.83c.46 0 .84-.16 1.14-.47.3-.31.46-.66.46-1.05 0-.38-.16-.73-.46-1.04a1.53 1.53 0 0 0-1.14-.47H9.9Zm6.83 1.32c.93 0 1.66.25 2.2.75.53.5.8 1.18.8 2.04v4.13h-1.2v-.93h-.06c-.52.77-1.21 1.15-2.08 1.15-.74 0-1.36-.22-1.85-.66a2.1 2.1 0 0 1-.74-1.64c0-.7.26-1.25.79-1.66.53-.41 1.23-.62 2.11-.62.75 0 1.37.14 1.85.41v-.29c0-.43-.17-.8-.51-1.1a1.79 1.79 0 0 0-1.21-.45c-.7 0-1.25.29-1.66.88l-1.1-.69c.6-.88 1.5-1.32 2.66-1.32Zm-1.62 4.87c0 .33.14.6.41.81.28.22.6.33.97.33.52 0 .98-.19 1.39-.58.4-.38.61-.83.61-1.35a2.6 2.6 0 0 0-1.64-.47c-.5 0-.92.12-1.25.36-.33.24-.49.55-.49.9Z" />
            <path d="M26.4 7.7l-4.4 10.1h-1.34l1.63-3.53-2.9-6.57h1.4l2.09 5.04h.03l2.04-5.04h1.45Z" />
            <text x="29" y="14.4" fontSize="9" fontFamily="ui-sans-serif, system-ui" fontWeight="500">Pay</text>
          </svg>
        </Frame>
      ) : null}

      {show("paypal") ? (
        <Frame label="PayPal">
          <svg viewBox="0 0 46 20" className={cls} fill="currentColor" aria-hidden>
            <path d="M6.7 4.4h3.9c1.9 0 3.1 1 2.86 2.86-.27 2.1-1.72 3.16-3.75 3.16H8.3l-.5 3.2H5.5l1.2-9.22Zm1.85 1.5-.4 2.97h1.2c1 0 1.7-.5 1.82-1.5.12-.98-.44-1.47-1.4-1.47H8.55Z" />
            <path d="M15.2 6.2h3.9c1.9 0 3.1 1 2.86 2.86-.27 2.1-1.72 3.16-3.75 3.16H16.8l-.5 3.2H14l1.2-9.22Zm1.85 1.5-.4 2.97h1.2c1 0 1.7-.5 1.82-1.5.12-.98-.44-1.47-1.4-1.47h-1.22Z" opacity="0.55" />
            <text x="24" y="13.6" fontSize="8.5" fontFamily="ui-sans-serif, system-ui" fontWeight="600">PayPal</text>
          </svg>
        </Frame>
      ) : null}

      {show("klarna") ? (
        <Frame label="Klarna">
          <svg viewBox="0 0 44 20" className={cls} fill="currentColor" aria-hidden>
            <text x="2" y="14" fontSize="10" fontFamily="ui-sans-serif, system-ui" fontWeight="700" letterSpacing="-0.3">Klarna</text>
          </svg>
        </Frame>
      ) : null}

      {show("sepa_debit") ? (
        <Frame label="SEPA-Lastschrift">
          <svg viewBox="0 0 34 20" className={cls} fill="currentColor" aria-hidden>
            <text x="2" y="14" fontSize="9.5" fontFamily="ui-sans-serif, system-ui" fontWeight="700" letterSpacing="0.2">SEPA</text>
          </svg>
        </Frame>
      ) : null}
    </div>
  );
}

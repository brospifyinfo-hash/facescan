"use client";

// Payment-method marks, in the schemes' own colours.
//
// These replaced neutral monochrome glyphs. The old file argued that a
// wrong-coloured Visa mark is worse than none — the answer to that is to get
// the colours right, not to avoid the problem: a row of grey shapes tells a
// buyer nothing, and "which cards do you take" is a question people answer by
// recognising a logo in a fifth of a second.
//
// EACH SITS ON ITS OWN TILE, and nearly all of those tiles are white. Card
// schemes specify their marks for light grounds; dropping a Visa blue onto a
// near-black card is exactly the kind of "close enough" that makes a checkout
// look improvised. Klarna and Amex bring their own ground colour, so they get
// that instead.
//
// The geometry is drawn (Mastercard's discs, the Apple mark, Google's G) and
// the wordmarks are set in type. Tracing letterforms would be more faithful
// and far more fragile; at 24px tall, weight and colour are what carry
// recognition.
//
// ONLY RENDER WHAT STRIPE WILL ACTUALLY OFFER. A mark for a method that then
// fails to appear at the payment step is its own small betrayal.

function Tile({
  children,
  label,
  bg = "#ffffff",
  width = 38,
}: {
  children: React.ReactNode;
  label: string;
  bg?: string;
  width?: number;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex h-6 shrink-0 items-center justify-center rounded-[5px] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.35)]"
      style={{ background: bg, width }}
    >
      {children}
    </span>
  );
}

/** A wordmark. `style` carries the brand's own colour and weight. */
function Word({
  text,
  color,
  size = 9.5,
  italic = false,
  weight = 800,
  tracking = "0.01em",
}: {
  text: string;
  color: string;
  size?: number;
  italic?: boolean;
  weight?: number;
  tracking?: string;
}) {
  return (
    <span
      style={{
        color,
        fontSize: size,
        fontWeight: weight,
        fontStyle: italic ? "italic" : "normal",
        letterSpacing: tracking,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        lineHeight: 1,
      }}
    >
      {text}
    </span>
  );
}

function Visa() {
  return (
    <Tile label="Visa">
      <Word text="VISA" color="#1434CB" size={11} italic weight={800} tracking="-0.02em" />
    </Tile>
  );
}

function Mastercard() {
  // The two discs and their intersection. The overlap is its own shape rather
  // than a blend mode — a mix-blend on a white tile inside a dark page is one
  // stacking-context change away from turning into a grey blob.
  return (
    <Tile label="Mastercard">
      <svg viewBox="0 0 36 22" className="h-[15px] w-auto" aria-hidden>
        <circle cx="14" cy="11" r="9" fill="#EB001B" />
        <circle cx="22" cy="11" r="9" fill="#F79E1B" />
        <path
          d="M18 4.1a9 9 0 0 0 0 13.8 9 9 0 0 0 0-13.8z"
          fill="#FF5F00"
        />
      </svg>
    </Tile>
  );
}

function Amex() {
  return (
    <Tile label="American Express" bg="#1F72CD">
      <Word text="AMEX" color="#ffffff" size={9} weight={800} tracking="0.02em" />
    </Tile>
  );
}

function PayPal() {
  return (
    <Tile label="PayPal" width={44}>
      <span className="flex items-baseline">
        <Word text="Pay" color="#003087" size={10} weight={800} tracking="-0.01em" />
        <Word text="Pal" color="#009CDE" size={10} weight={800} tracking="-0.01em" />
      </span>
    </Tile>
  );
}

function Klarna() {
  return (
    <Tile label="Klarna" bg="#FFB3C7" width={44}>
      <Word text="Klarna." color="#0B051D" size={10} weight={800} tracking="-0.01em" />
    </Tile>
  );
}

function ApplePay() {
  return (
    <Tile label="Apple Pay" width={44}>
      <span className="flex items-center gap-[2px]">
        <svg viewBox="0 0 24 24" className="h-[12px] w-[12px]" aria-hidden>
          <path
            d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
            fill="#000000"
          />
        </svg>
        <Word text="Pay" color="#000000" size={10} weight={600} tracking="-0.01em" />
      </span>
    </Tile>
  );
}

function GooglePay() {
  // Google's four-colour G, then "Pay" in their UI grey.
  return (
    <Tile label="Google Pay" width={44}>
      <span className="flex items-center gap-[3px]">
        <svg viewBox="0 0 48 48" className="h-[13px] w-[13px]" aria-hidden>
          <path
            fill="#4285F4"
            d="M45.1 24.5c0-1.6-.1-2.7-.4-3.9H24v7.1h12.1c-.2 1.8-1.6 4.5-4.5 6.3l6.9 5.3c4.1-3.8 6.6-9.4 6.6-14.8z"
          />
          <path
            fill="#34A853"
            d="M24 46c5.9 0 10.9-1.9 14.5-5.3l-6.9-5.3c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8.1 41.1 15.4 46 24 46z"
          />
          <path
            fill="#FBBC04"
            d="M11.5 28.5c-.5-1.4-.7-2.9-.7-4.5s.3-3.1.7-4.5l-7.1-5.5C2.9 17 2 20.4 2 24s.9 7 2.4 10l7.1-5.5z"
          />
          <path
            fill="#EA4335"
            d="M24 10.6c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 4.5 29.9 2 24 2 15.4 2 8.1 6.9 4.4 14l7.1 5.5c1.8-5.3 6.7-8.9 12.5-8.9z"
          />
        </svg>
        <Word text="Pay" color="#5F6368" size={10} weight={600} tracking="-0.01em" />
      </span>
    </Tile>
  );
}

const MARKS = {
  visa: Visa,
  mastercard: Mastercard,
  amex: Amex,
  paypal: PayPal,
  klarna: Klarna,
  apple_pay: ApplePay,
  google_pay: GooglePay,
} as const;

export type PaymentMethodId = keyof typeof MARKS;

/**
 * Wallets first, then the cards, then buy-now-pay-later.
 *
 * One exported constant so the row under the package list and the row under
 * the pay button can never claim different things.
 */
export const DEFAULT_METHODS: readonly PaymentMethodId[] = [
  "apple_pay",
  "google_pay",
  "paypal",
  "visa",
  "mastercard",
  "amex",
  "klarna",
];

export function PaymentIcons({
  methods = DEFAULT_METHODS,
  className = "",
}: {
  methods?: readonly PaymentMethodId[];
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {methods.map((id) => {
        const Mark = MARKS[id];
        return Mark ? <Mark key={id} /> : null;
      })}
    </div>
  );
}

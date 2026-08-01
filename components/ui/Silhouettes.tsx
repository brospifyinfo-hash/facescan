// Dashed silhouette guides for the photo-upload placeholders.

export function FrontSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 110" className={className} fill="none" aria-hidden>
      <ellipse
        cx="50"
        cy="42"
        rx="24"
        ry="30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <path
        d="M42 70 v10 c0 2 -2 4 -5 5 l-15 6 c-4 2 -6 5 -6 9 v10 M58 70 v10 c0 2 2 4 5 5 l15 6 c4 2 6 5 6 9 v10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      {/* eye line + center guide */}
      <line x1="34" y1="40" x2="66" y2="40" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.5" />
      <line x1="50" y1="16" x2="50" y2="70" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.5" />
    </svg>
  );
}

export function SideSilhouette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 110" className={className} fill="none" aria-hidden>
      <path
        d="M62 14
           C 46 12, 36 22, 35 34
           C 34.4 41, 36 45, 34 49
           L 29.5 56.5 L 34.5 58.5
           C 34.5 61.5, 34 64, 36.5 65.5
           C 38.5 66.7, 41.5 65.8, 43 67.5
           C 44.2 70.5, 43.5 74, 47 76.5
           C 52 79.5, 60 77, 64.5 72.5
           L 66 80 c 0.5 4, 4 7, 8 8.5 l 12 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      {/* ear */}
      <path
        d="M63 46 c 5 -2, 8 2, 6.5 7 c -1.2 4 -4.5 6 -7 5.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />
      {/* horizontal guide */}
      <line x1="28" y1="42" x2="74" y2="42" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.5" />
    </svg>
  );
}

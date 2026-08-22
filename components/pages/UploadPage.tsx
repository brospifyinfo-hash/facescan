"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lightbulb, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { PhotoDrop } from "@/components/upload/PhotoDrop";
import { FrontSilhouette, SideSilhouette } from "@/components/ui/Silhouettes";
import { useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

export function UploadPage() {
  const router = useRouter();
  const t = useT();
  const { photos, setPhoto } = useFunnel();
  // Only the front photo drives the measurements, so it is the only one
  // required. The side shot just gives the AI report a second angle.
  const ready = Boolean(photos.front);

  // Pick up ?raw=1 here so the diagnostic survives to /results.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("raw")) {
      sessionStorage.setItem("facescan.raw", "1");
    }
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 py-8">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-1 flex-col justify-center py-8"
      >
        <h1 className="text-3xl font-semibold tracking-tight">{t.upload.title}</h1>
        <p className="mt-2 text-sm text-[var(--color-ink-tertiary)]">{t.upload.sub}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {t.upload.tips.map((tip) => (
            <span
              key={tip}
              className="fill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-[var(--color-ink-secondary)]"
            >
              <Lightbulb className="h-3 w-3 text-accent" /> {tip}
            </span>
          ))}
        </div>

        {/* Side by side on every width — the two shots are a pair and read
            as one instruction. */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-6">
          <PhotoDrop
            label={t.upload.front}
            hint={t.upload.frontHint}
            silhouette={<FrontSilhouette className="h-full w-full" />}
            value={photos.front}
            onPhoto={(p) => setPhoto("front", p)}
          />
          <PhotoDrop
            label={t.upload.side}
            badge={t.upload.optional}
            hint={t.upload.sideHint}
            silhouette={<SideSilhouette className="h-full w-full" />}
            value={photos.side}
            onPhoto={(p) => setPhoto("side", p)}
          />
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-tertiary)]">
          {t.upload.sideSkipNote}
        </p>

        <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-[var(--color-ink-tertiary)]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-accent" />
            {t.upload.privacy}
          </p>
          <Button size="lg" disabled={!ready} onClick={() => router.push("/scan")}>
            {t.upload.cta} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lightbulb, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { PhotoDrop } from "@/components/upload/PhotoDrop";
import { FrontSilhouette, SideSilhouette } from "@/components/ui/Silhouettes";
import { useT } from "@/lib/i18n";
import { useFunnel } from "@/lib/store";

export default function UploadPage() {
  const router = useRouter();
  const t = useT();
  const { photos, setPhoto } = useFunnel();
  const ready = Boolean(photos.front && photos.side);

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
        <p className="mt-2 text-sm text-zinc-500">{t.upload.sub}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {t.upload.tips.map((tip) => (
            <span
              key={tip}
              className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-zinc-400"
            >
              <Lightbulb className="h-3 w-3 text-accent" /> {tip}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <PhotoDrop
            label={t.upload.front}
            hint={t.upload.frontHint}
            silhouette={<FrontSilhouette className="h-full w-full" />}
            value={photos.front}
            onPhoto={(p) => setPhoto("front", p)}
          />
          <PhotoDrop
            label={t.upload.side}
            hint={t.upload.sideHint}
            silhouette={<SideSilhouette className="h-full w-full" />}
            value={photos.side}
            onPhoto={(p) => setPhoto("side", p)}
          />
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-zinc-500">
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

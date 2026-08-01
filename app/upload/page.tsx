"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Lightbulb, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PhotoDrop } from "@/components/upload/PhotoDrop";
import {
  FrontSilhouette,
  SideSilhouette,
} from "@/components/ui/Silhouettes";
import { useFunnel } from "@/lib/store";

const TIPS = [
  "Even, natural light — face a window",
  "Neutral expression, mouth closed",
  "No glasses, hair off the face",
];

export default function UploadPage() {
  const router = useRouter();
  const { photos, setPhoto } = useFunnel();
  const ready = Boolean(photos.front && photos.side);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-semibold tracking-tight">
          Two photos. That&apos;s it.
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          The scan maps 478 facial landmarks from your front profile; the side
          profile refines the geometry.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {TIPS.map((tip) => (
            <span
              key={tip}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-400"
            >
              <Lightbulb className="h-3 w-3 text-accent" /> {tip}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <PhotoDrop
            label="Front Profile"
            hint="Look straight into the camera, head level."
            silhouette={<FrontSilhouette className="h-full w-full" />}
            value={photos.front}
            onPhoto={(p) => setPhoto("front", p)}
          />
          <PhotoDrop
            label="Side Profile"
            hint="Turn 90° — ear toward the camera."
            silhouette={<SideSilhouette className="h-full w-full" />}
            value={photos.side}
            onPhoto={(p) => setPhoto("side", p)}
          />
        </div>

        <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Photos stay in this browser tab — nothing is uploaded during the
            free scan.
          </p>
          <Button
            size="lg"
            disabled={!ready}
            onClick={() => router.push("/scan")}
          >
            Start Analysis <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </main>
  );
}

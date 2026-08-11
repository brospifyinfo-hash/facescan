"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n";
import { PROBLEM_TAGS, PLAN_FOR_TAG, type Product, type ProblemTag } from "@/lib/products/types";
import { cn } from "@/lib/cn";

// The catalogue editor.
//
// One screen: the list, and a form that is either creating or editing. No
// routing between them — this is an owner tool with a handful of rows, and a
// detail route would be more moving parts than the job has.
//
// It is a client component and it enforces nothing. Every button here calls a
// route that re-checks the session server-side; if this file were served to a
// stranger the worst they could do is look at a form that 401s.

const EMPTY = {
  title: "",
  description: "",
  price: "",
  imageUrl: "",
  affiliateLink: "",
  tags: [] as ProblemTag[],
  active: true,
};

type Draft = typeof EMPTY;

export function ProductAdmin({ admin }: { admin: string }) {
  const t = useT();
  const [items, setItems] = useState<Product[]>([]);
  const [backing, setBacking] = useState<"redis" | "memory">("memory");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { products: Product[]; backing: "redis" | "memory" };
        setItems(data.products);
        setBacking(data.backing);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErrors([]);
    try {
      const res = await fetch(
        editingId ? `/api/admin/products/${editingId}` : "/api/admin/products",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { details?: string[]; error?: string };
        setErrors(data.details ?? [data.error ?? `HTTP ${res.status}`]);
        return;
      }
      setDraft(null);
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Product) => {
    // Deleting a product is not recoverable and the row carries no other
    // signal that it is about to vanish, so it asks.
    if (!window.confirm(`${t.admin.confirmDelete}\n\n${p.title}`)) return;
    setBusy(true);
    try {
      await fetch(`/api/admin/products/${p.id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setErrors([]);
    setDraft({
      title: p.title,
      description: p.description,
      price: p.price,
      imageUrl: p.imageUrl,
      affiliateLink: p.affiliateLink,
      tags: p.tags,
      active: p.active,
    });
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="t-title2">{t.admin.title}</h1>
          <p className="t-caption mt-1 text-[var(--color-ink-tertiary)]">
            {admin} · {items.length} {t.admin.productsLabel}
          </p>
        </div>
        {draft === null ? (
          <Button
            onClick={() => {
              setEditingId(null);
              setErrors([]);
              setDraft({ ...EMPTY });
            }}
          >
            <Plus className="h-4 w-4" />
            {t.admin.newProduct}
          </Button>
        ) : null}
      </header>

      {/* Not a nicety. Without Upstash the store is per-instance memory, so
          everything typed here is gone on the next cold start — which looks
          exactly like the app losing data at random unless it is stated. */}
      {backing === "memory" ? (
        <p className="mt-4 flex items-start gap-2 rounded-[var(--r-card)] border border-[var(--color-caution)]/30 bg-[var(--color-caution)]/[0.07] p-3 text-[12px] leading-relaxed text-[var(--color-caution)]">
          <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden />
          {t.admin.memoryWarning}
        </p>
      ) : null}

      {draft !== null ? (
        <section className="panel mt-5 p-[var(--pad-panel)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="t-title3">
              {editingId ? t.admin.editProduct : t.admin.newProduct}
            </h2>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
              }}
              className="rounded-full p-1.5 text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink)]"
              aria-label={t.admin.cancel}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <Field label={t.admin.fieldTitle}>
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>

            <Field label={t.admin.fieldDescription}>
              <textarea
                className={cn(inputClass, "min-h-[76px] resize-y")}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.admin.fieldPrice} hint={t.admin.priceHint}>
                <input
                  className={inputClass}
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                  placeholder="24,99 €"
                />
              </Field>
              <Field label={t.admin.fieldActive}>
                <label className="flex h-[42px] items-center gap-2 text-[13px] text-[var(--color-ink-secondary)]">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                    className="h-4 w-4 accent-[var(--color-accent)]"
                  />
                  {t.admin.activeHint}
                </label>
              </Field>
            </div>

            <Field label={t.admin.fieldImage}>
              <input
                className={inputClass}
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                placeholder="https://…"
                inputMode="url"
              />
            </Field>

            <Field label={t.admin.fieldLink}>
              <input
                className={inputClass}
                value={draft.affiliateLink}
                onChange={(e) => setDraft({ ...draft, affiliateLink: e.target.value })}
                placeholder="https://…"
                inputMode="url"
              />
            </Field>

            <Field label={t.admin.fieldTags} hint={t.admin.tagsHint}>
              <div className="flex flex-wrap gap-1.5">
                {PROBLEM_TAGS.map((tag) => {
                  const on = draft.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          tags: on
                            ? draft.tags.filter((x) => x !== tag)
                            : [...draft.tags, tag],
                        })
                      }
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                        on
                          ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/[0.12] text-[var(--color-accent)]"
                          : "border-white/10 text-[var(--color-ink-secondary)] hover:border-white/20",
                      )}
                      title={tag}
                    >
                      {t.plan[PLAN_FOR_TAG[tag]].short}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          {errors.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded-[var(--r-inner)] border border-red-500/30 bg-red-500/[0.07] p-3">
              {errors.map((e) => (
                <li key={e} className="text-[12px] text-red-300">
                  {e}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 flex gap-2">
            <Button onClick={save} disabled={busy}>
              {busy ? t.admin.saving : t.admin.save}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(null);
                setEditingId(null);
              }}
            >
              {t.admin.cancel}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-2.5">
        {loading ? (
          <p className="t-caption text-[var(--color-ink-tertiary)]">{t.admin.loading}</p>
        ) : items.length === 0 ? (
          <p className="t-caption text-[var(--color-ink-tertiary)]">{t.admin.empty}</p>
        ) : (
          items.map((p) => (
            <article
              key={p.id}
              className={cn("panel flex gap-3 p-3", !p.active && "opacity-55")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-[12px] bg-white/[0.04] object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-[14px] font-semibold">{p.title}</h3>
                  <span className="tnum shrink-0 text-[13px] text-[var(--color-ink-secondary)]">
                    {p.price}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--color-ink-tertiary)]">
                  {p.description}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.tags.map((tag) => (
                    <span
                      key={tag}
                      className="fill rounded-full px-2 py-0.5 text-[10.5px] text-[var(--color-ink-secondary)]"
                    >
                      {t.plan[PLAN_FOR_TAG[tag]].short}
                    </span>
                  ))}
                  {!p.active ? (
                    <span className="rounded-full bg-[var(--color-caution)]/15 px-2 py-0.5 text-[10.5px] text-[var(--color-caution)]">
                      {t.admin.inactive}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(p)}
                  className="rounded-lg p-2 text-[var(--color-ink-tertiary)] hover:bg-white/[0.06] hover:text-[var(--color-ink)]"
                  aria-label={t.admin.edit}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(p)}
                  disabled={busy}
                  className="rounded-lg p-2 text-[var(--color-ink-tertiary)] hover:bg-red-500/10 hover:text-red-300"
                  aria-label={t.admin.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

const inputClass =
  "w-full rounded-[var(--r-control)] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[14px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-quaternary)] focus:border-[var(--color-accent)]/50";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="t-eyebrow block">{label}</span>
      {hint ? (
        <span className="t-caption mb-1.5 block text-[var(--color-ink-tertiary)]">{hint}</span>
      ) : (
        <span className="mb-1.5 block" />
      )}
      {children}
    </label>
  );
}

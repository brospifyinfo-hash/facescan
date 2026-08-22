import { notFound } from "next/navigation";
import { CheckoutDemo } from "@/components/checkout/CheckoutDemo";
import { PLAN_ORDER, type PlanId } from "@/lib/pricing";

// DEVELOPMENT ONLY — the plan sheet without the funnel in front of it, so
// each tier's selected state can be looked at directly. Production answers
// 404. Same arrangement as /admin/auth-demo and /admin/globe-demo.
export const dynamic = "force-dynamic";

export default async function CheckoutDemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const raw = Array.isArray(params.plan) ? params.plan[0] : params.plan;
  const start = (PLAN_ORDER as string[]).includes(raw ?? "")
    ? (raw as PlanId)
    : "blueprint";
  return <CheckoutDemo start={start} />;
}

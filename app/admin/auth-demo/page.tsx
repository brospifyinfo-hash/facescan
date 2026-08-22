import { notFound } from "next/navigation";
import { AuthDemo } from "@/components/auth/AuthDemo";

// DEVELOPMENT ONLY — the sign-in sheet on a page of its own so its states
// can be looked at (and screenshotted) without clicking through the funnel.
// Production answers 404: a demo route in prod is clutter pretending to be
// a feature. Same arrangement as /admin/globe-demo.
export const dynamic = "force-dynamic";

export default async function AuthDemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return <AuthDemo start={pick(params.start) === "login" ? "login" : "register"} what={pick(params.what) ?? "modal"} />;
}

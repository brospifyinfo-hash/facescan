import { BrandLoadingScreen } from "@/components/ui/BrandLoader";

// The app-wide loading screen.
//
// Next.js renders this automatically while a route segment is still
// streaming, which makes it the one place a loading state reaches every page
// without a single call site. Before it existed the gap between pages was a
// blank canvas — briefly indistinguishable from a page that failed to load.
//
// No copy: this is measured in a few hundred milliseconds on a warm route,
// and a sentence that flashes and vanishes is noise. The mark and the arc say
// "loading" without asking anyone to read.
export default function Loading() {
  return <BrandLoadingScreen />;
}

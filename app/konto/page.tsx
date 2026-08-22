import { AccountView } from "@/components/account/AccountView";

// Private by definition: a person's own scans. Not indexed, and given its
// own title so a bookmark or a browser tab says what it is.
export const metadata = {
  title: "Dein Konto",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return <AccountView />;
}

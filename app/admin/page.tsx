import { redirect } from "next/navigation";

// /admin is an address people type from memory; the live view is the room
// they mean.
export default function AdminIndex() {
  redirect("/admin/live");
}

import { redirect } from "next/navigation";

export default function LegacyZernioAdminPage() {
  redirect("/admin/diagnostics");
}

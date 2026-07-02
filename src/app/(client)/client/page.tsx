import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants";

/** `/client` → the client dashboard. */
export default function ClientIndexPage() {
  redirect(ROUTES.CLIENT_DASHBOARD);
}

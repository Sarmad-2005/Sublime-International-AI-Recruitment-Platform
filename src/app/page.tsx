import { redirect } from "next/navigation";

import { authService } from "@/lib/services";
import { ROLE_HOME_ROUTE, ROUTES } from "@/lib/constants";

/**
 * Root route. SIORP has no marketing landing page yet, so `/` just routes the
 * caller to the right place: signed-in users land on their role dashboard,
 * everyone else goes to the login screen.
 */
export default async function Home() {
  const user = await authService.getCurrentUser();
  redirect(user ? ROLE_HOME_ROUTE[user.role] : ROUTES.LOGIN);
}

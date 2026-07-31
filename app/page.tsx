import { redirect } from "next/navigation";
import { validateRequest } from "@/lib/auth/session";
import { isSetupComplete } from "@/lib/db/queries/setup";

export default async function RootPage() {
  if (!(await isSetupComplete())) redirect("/setup");

  const { user } = await validateRequest();
  redirect(user ? "/dashboard" : "/login");
}

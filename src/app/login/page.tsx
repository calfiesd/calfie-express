import { redirect } from "next/navigation";
import { SiteNav } from "@/components/site-nav";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getSessionUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      <SiteNav />
      <AuthForm />
    </>
  );
}

import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2, MailWarning } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isPublicMealMateRoute } from "@/lib/route-access";
import { AuthForm } from "@/components/auth-form";

// Inactive sessions are signed out after this window.
const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useSession();
  const navigate = useNavigate();

  const needsAccount = !isPublicMealMateRoute(pathname);

  // Inactivity timeout: sign out after N minutes of no interaction.
  useEffect(() => {
    if (!user) return;
    let lastActivity = Date.now();
    const bump = () => {
      lastActivity = Date.now();
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    const iv = window.setInterval(async () => {
      if (Date.now() - lastActivity > INACTIVITY_MS) {
        window.clearInterval(iv);
        events.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
        await supabase.auth.signOut();
        toast.message("Signed out due to inactivity.");
        navigate({ to: "/auth", replace: true });
      }
    }, 60 * 1000);
    return () => {
      window.clearInterval(iv);
      events.forEach((e) => window.removeEventListener(e, bump, { capture: true }));
    };
  }, [user, navigate]);

  if (!needsAccount) return <>{children}</>;

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) {
    return <SignInPrompt />;
  }

  // Email verification enforcement: block until confirmed_at is set.
  const confirmed = Boolean(user.email_confirmed_at || user.confirmed_at);
  if (user.email && !confirmed) {
    return <VerifyEmailPrompt email={user.email} />;
  }

  return <>{children}</>;
}

function SignInPrompt() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-display text-2xl">Sign in to continue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in or create an account to access your personal MealMate features.
        </p>
        <div className="mt-6"><AuthForm redirectTo={pathname} /></div>
      </div>
    </main>
  );
}

function VerifyEmailPrompt({ email }: { email: string }) {
  async function resend() {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) toast.error(error.message);
    else toast.success("Verification email sent. Check your inbox.");
  }
  async function signOut() {
    await supabase.auth.signOut();
  }
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <MailWarning className="h-6 w-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl">Verify your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
          Click it to unlock MealMate.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={resend}>Resend verification email</Button>
          <Button variant="outline" onClick={signOut}>Use a different account</Button>
        </div>
      </div>
    </main>
  );
}

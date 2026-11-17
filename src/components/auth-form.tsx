import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "signin" | "signup";

function authRedirectUrl(path: string): string {
  const configured = import.meta.env["VITE_SUPABASE_REDIRECT_URL"] as string | undefined;
  return configured
    ? `${configured.replace(/\/$/, "")}${path}`
    : `${window.location.origin}${path}`;
}

export function AuthForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    if (busy) return;
    setBusy(true);
    try {
      const host = window.location.hostname;
      const lovableHosted = /(^|\.)lovable\.app$|(^|\.)lovableproject\.com$|^localhost$/.test(host);
      if (!lovableHosted) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        return;
      }
      const { lovable } = await import("@/integrations/lovable");
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
    } catch {
      toast.error("Google sign-in is unavailable. Please use email and password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || password.length < 6) {
        toast.error("Enter a valid email and a password with at least 6 characters.");
        return;
      }

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: authRedirectUrl("/auth/callback"),
            data: { display_name: displayName || normalizedEmail.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          toast.error("An account with this email already exists. Sign in instead.");
          setMode("signin");
          return;
        }
        if (!data.session) {
          toast.success("Check your inbox to verify your email before signing in.");
          setMode("signin");
          return;
        }
        toast.success("Welcome to MealMate!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
      }
      await navigate({ to: redirectTo, replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      toast.error(
        message.toLowerCase().includes("invalid login credentials")
          ? "Invalid email or password."
          : message.toLowerCase().includes("email not confirmed")
            ? "Please verify your email before signing in."
            : message,
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendResetEmail() {
    if (!email.trim()) {
      toast.error("Enter your email first, then tap forgot password.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl("/reset-password"),
      });
      if (error) throw error;
      toast.success("Check your inbox for a reset link.");
    } catch {
      toast.error("Could not send the reset email. Please check the address and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        {mode === "signup" && (
          <div className="space-y-1.5">
            <Label htmlFor="account-name">Display name</Label>
            <Input
              id="account-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="account-email">Email</Label>
          <Input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account-password">Password</Label>
          <div className="relative">
            <Input
              id="account-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-10 w-10"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={signInWithGoogle}>
          Continue with Google
        </Button>
      </form>
      {mode === "signin" && (
        <Button type="button" variant="link" className="mt-2 w-full" disabled={busy} onClick={sendResetEmail}>
          Forgot password?
        </Button>
      )}
      <p className="mt-3 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => setMode((current) => (current === "signin" ? "signup" : "signin"))}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
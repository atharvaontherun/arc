"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { AuthLayout, Button, StatusMessage, TextInput } from "@/src/components/arc/ui";

export default function LoginPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <AuthLayout
      title="Welcome back."
      description="Log in to continue your Arc."
      footer={<>Don&apos;t have an account? <Link className="text-arc-ink underline decoration-arc-line underline-offset-4 transition-colors hover:text-white" href="/signup">Create one</Link></>}
    >
      <form className="space-y-6" onSubmit={handleLogin}>
        <TextInput autoComplete="email" id="login-email" label="Email" onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required type="email" value={email} />
        <TextInput autoComplete="current-password" id="login-password" label="Password" onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required type="password" value={password} />
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        <Button className="w-full" type="submit">LOG IN</Button>
      </form>
    </AuthLayout>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { AuthLayout, Button, StatusMessage, TextInput } from "@/src/components/arc/ui";

export default function SignupPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      window.location.href = "/dashboard";
      return;
    }

    setMessage("Account created! Check your email to confirm it.");
  }

  return (
    <AuthLayout
      title="Create your account."
      description="Start your Arc."
      footer={<>Already have an account? <Link className="text-arc-ink underline decoration-arc-line underline-offset-4 transition-colors hover:text-white" href="/login">Log in</Link></>}
    >
      <form className="space-y-6" onSubmit={handleSignup}>
        <TextInput autoComplete="email" id="signup-email" label="Email" onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required type="email" value={email} />
        <TextInput autoComplete="new-password" id="signup-password" label="Password" onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" required type="password" value={password} />
        {error && <StatusMessage kind="error">{error}</StatusMessage>}
        {message && <StatusMessage kind="success">{message}</StatusMessage>}
        <Button className="w-full" type="submit">CREATE ACCOUNT</Button>
      </form>
    </AuthLayout>
  );
}

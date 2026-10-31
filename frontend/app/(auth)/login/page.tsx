"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/badge";
import { FieldError } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await apiPost<AuthResponse>("/auth/login/", values);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      router.push("/connections");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Invalid email or password");
    }
  }

  return (
    <div className="w-full max-w-[460px]">
      {/* Seamless Form Container - No border, No background color */}
      <div className="w-full">
        {/* Simple, Punchy Header */}
        <div className="mb-8 text-left">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Welcome back to Dbench.
          </p>
        </div>

        {/* Longer Form with generous spacing */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {serverError && (
            <Alert variant="destructive" className="bg-red-950/50 border-red-900/50 text-red-200 text-xs py-3">
              {serverError}
            </Alert>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-xs font-mono font-medium text-zinc-300">
              Email address
            </label>
            <div className="relative flex items-center rounded-xl border border-zinc-800 bg-[#070707] transition-all focus-within:border-emerald-500/70 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <span className="pl-4 text-zinc-500 select-none">
                <Mail className="size-4" />
              </span>
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                className="w-full bg-transparent px-3 py-3 h-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                {...register("email")}
              />
            </div>
            <FieldError message={formState.errors.email?.message} />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-mono font-medium text-zinc-300">
              Password
            </label>
            <div className="relative flex items-center rounded-xl border border-zinc-800 bg-[#070707] transition-all focus-within:border-emerald-500/70 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <span className="pl-4 text-zinc-500 select-none">
                <Lock className="size-4" />
              </span>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent px-3 py-3 h-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none pr-11"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <FieldError message={formState.errors.password?.message} />
          </div>

          {/* Primary Action Button (Longer & prominent) */}
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="w-full mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-6 py-4 text-sm font-bold text-zinc-950 transition shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            {formState.isSubmitting ? (
              <>
                <Spinner className="size-4 text-zinc-950" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </form>

        {/* Clean, Simple Footer Switch */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 flex items-center justify-between text-xs">
          <span className="text-zinc-400">Don&apos;t have an account?</span>
          <Link
            href="/register"
            className="font-mono text-emerald-400 hover:text-emerald-300 transition-colors font-medium flex items-center gap-1"
          >
            <span>Create account</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
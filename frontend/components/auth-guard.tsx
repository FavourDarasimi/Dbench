"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { Spinner } from "@/components/ui/badge";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me/"),
    retry: false,
  });
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading, isError } = useCurrentUser();

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) return null;
  return <>{children}</>;
}

export function RedirectIfAuthenticated({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && data) {
      router.replace("/connections");
    }
  }, [data, isLoading, router]);

  if (data) return null;
  return <>{children}</>;
}

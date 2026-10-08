"use client";

import { Spinner } from "@/components/ui/badge";
import { useCurrentUser } from "@/components/auth-guard";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();

  useEffect(() => {
    if (isLoading) return;
    router.replace(data ? "/connections" : "/login");
  }, [data, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}

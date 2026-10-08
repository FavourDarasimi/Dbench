"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api, apiPost, apiPatch } from "@/lib/api";
import type { Connection, ConnectionPayload, Engine, SslMode, TestResult } from "@/lib/types";

const SSL_MODES: SslMode[] = ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"];

const schema = z
  .object({
    name: z.string().min(1, "Name is required"),
    engine: z.enum(["postgres", "mysql"]),
    host: z.string().min(1, "Host is required"),
    port: z.string().regex(/^\d+$/, "Port must be a number"),
    db_name: z.string().min(1, "Database name is required"),
    username: z.string(),
    password: z.string().optional(),
    ssl_mode: z.enum(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]),
    read_only: z.boolean(),
    ssh_enabled: z.boolean(),
    ssh_host: z.string().optional(),
    ssh_port: z.string().optional(),
    ssh_username: z.string().optional(),
    ssh_password: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.ssh_enabled) return;
    if (!values.ssh_host) {
      ctx.addIssue({ code: "custom", path: ["ssh_host"], message: "SSH host is required when the tunnel is enabled" });
    }
    if (!values.ssh_username) {
      ctx.addIssue({ code: "custom", path: ["ssh_username"], message: "SSH username is required when the tunnel is enabled" });
    }
    if (values.ssh_port && !/^\d+$/.test(values.ssh_port)) {
      ctx.addIssue({ code: "custom", path: ["ssh_port"], message: "Port must be a number" });
    }
  });

type FormValues = z.infer<typeof schema>;

function defaultsFor(connection?: Connection | null): FormValues {
  return {
    name: connection?.name ?? "",
    engine: connection?.engine ?? "postgres",
    host: connection?.host ?? "",
    port: String(connection?.port ?? 5432),
    db_name: connection?.db_name ?? "",
    username: connection?.username ?? "",
    password: "",
    ssl_mode: connection?.ssl_mode ?? "prefer",
    read_only: connection?.read_only ?? false,
    ssh_enabled: connection?.ssh_config?.enabled ?? false,
    ssh_host: connection?.ssh_config?.host ?? "",
    ssh_port: String(connection?.ssh_config?.port ?? 22),
    ssh_username: connection?.ssh_config?.username ?? "",
    ssh_password: "",
  };
}

function buildPayload(values: FormValues): ConnectionPayload {
  const payload: ConnectionPayload = {
    name: values.name,
    engine: values.engine,
    host: values.host,
    port: Number(values.port),
    db_name: values.db_name,
    username: values.username,
    ssl_mode: values.ssl_mode,
    read_only: values.read_only,
    ssh_config: {
      enabled: values.ssh_enabled,
      host: values.ssh_host ?? "",
      port: Number(values.ssh_port || 22),
      username: values.ssh_username ?? "",
    },
  };
  if (values.password) payload.password = values.password;
  if (values.ssh_enabled && values.ssh_password) payload.ssh_config.password = values.ssh_password;
  return payload;
}

export function ConnectionForm({
  connection,
  onSaved,
}: {
  connection?: Connection | null;
  onSaved: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const { register, handleSubmit, reset, watch, setValue, trigger, getValues, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(connection),
  });

  useEffect(() => {
    reset(defaultsFor(connection));
    setTestResult(null);
    setServerError(null);
  }, [connection, reset]);

  const engine = watch("engine");
  const sshEnabled = watch("ssh_enabled");
  const passwordValue = watch("password");

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const payload = buildPayload(values);
      if (connection) {
        await apiPatch(`/connections/${connection.id}/`, payload);
      } else {
        await apiPost("/connections/", payload);
      }
      onSaved();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Saving failed");
    }
  }

  async function onTest() {
    const valid = await trigger();
    if (!valid) return;
    setTesting(true);
    setTestResult(null);
    setServerError(null);
    try {
      const values = getValues();
      const result =
        connection && !values.password
          ? await api<TestResult>(`/connections/${connection.id}/test/`, { method: "POST" })
          : await apiPost<TestResult>("/connections/test/", buildPayload(values));
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Test failed",
        latency_ms: null,
        server_version: null,
      });
    } finally {
      setTesting(false);
    }
  }

  const usingStoredPassword = Boolean(connection) && !passwordValue;

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{connection ? "Edit connection" : "New connection"}</DialogTitle>
        <DialogDescription>
          Credentials are encrypted at rest and never sent back to the browser.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
        {serverError && <Alert variant="destructive">{serverError}</Alert>}
        {testResult &&
          (testResult.ok ? (
            <Alert variant="success">
              Connected in {testResult.latency_ms} ms — {testResult.server_version}
            </Alert>
          ) : (
            <Alert variant="destructive">{testResult.error}</Alert>
          ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="production-db" {...register("name")} />
            <FieldError message={formState.errors.name?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="engine">Engine</Label>
            <select
              id="engine"
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("engine", {
                onChange: (event) => {
                  const value = event.target.value as Engine;
                  setValue("port", value === "postgres" ? "5432" : "3306");
                },
              })}
            >
              <option value="postgres">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ssl_mode">SSL mode</Label>
            <select
              id="ssl_mode"
              className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("ssl_mode")}
            >
              {SSL_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="host">Host</Label>
            <Input id="host" placeholder="db.example.com" {...register("host")} />
            <FieldError message={formState.errors.host?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="port">Port</Label>
            <Input id="port" inputMode="numeric" {...register("port")} />
            <FieldError message={formState.errors.port?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="db_name">Database</Label>
            <Input id="db_name" placeholder="appdb" {...register("db_name")} />
            <FieldError message={formState.errors.db_name?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="off" {...register("username")} />
            <FieldError message={formState.errors.username?.message} />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={connection ? "Leave blank to keep the stored password" : "Database password"}
              {...register("password")}
            />
            <FieldError message={formState.errors.password?.message} />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" {...register("read_only")} />
          Read-only connection (enforced by the database when querying)
        </label>

        <div className="rounded-md border p-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-primary" {...register("ssh_enabled")} />
            Connect through SSH tunnel
          </label>
          {sshEnabled && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ssh_host">SSH host</Label>
                <Input id="ssh_host" placeholder="bastion.example.com" {...register("ssh_host")} />
                <FieldError message={formState.errors.ssh_host?.message} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ssh_port">SSH port</Label>
                <Input id="ssh_port" inputMode="numeric" defaultValue={22} {...register("ssh_port")} />
                <FieldError message={formState.errors.ssh_port?.message} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ssh_username">SSH username</Label>
                <Input id="ssh_username" autoComplete="off" {...register("ssh_username")} />
                <FieldError message={formState.errors.ssh_username?.message} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ssh_password">SSH password</Label>
                <Input
                  id="ssh_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={connection ? "Leave blank to keep the stored password" : "SSH password"}
                  {...register("ssh_password")}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onTest}
            disabled={testing || formState.isSubmitting}
          >
            {testing && <Spinner />}
            Test connection
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Spinner />}
            {connection ? "Save changes" : "Add connection"}
          </Button>
        </DialogFooter>
        {usingStoredPassword && (
          <p className="text-right text-xs text-muted-foreground">
            Testing uses the stored password because none was re-entered.
          </p>
        )}
      </form>
    </DialogContent>
  );
}

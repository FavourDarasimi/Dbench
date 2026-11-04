"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  DatabaseIcon,
  Link02Icon,
  PlayIcon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";

import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api, apiPost, apiPatch } from "@/lib/api";
import type { Connection, ConnectionPayload, Engine, SslMode, TestResult } from "@/lib/types";

const SSL_MODES: SslMode[] = ["disable", "allow", "prefer", "require", "verify-ca", "verify-full"];

interface ParsedDatabaseUrl {
  engine: Engine;
  host: string;
  port: number;
  db_name: string;
  username: string;
  password?: string;
  ssl_mode: SslMode;
}

function parseDatabaseUrlClient(rawUrl: string): ParsedDatabaseUrl | null {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    const url = new URL(trimmed);
    const protocol = url.protocol.replace(":", "").toLowerCase();

    let engine: Engine;
    let defaultPort = 5432;
    if (["postgres", "postgresql"].includes(protocol)) {
      engine = "postgres";
      defaultPort = 5432;
    } else if (["mysql", "mysql2", "mariadb"].includes(protocol)) {
      engine = "mysql";
      defaultPort = 3306;
    } else {
      return null;
    }

    const host = url.hostname;
    if (!host) return null;

    const port = url.port ? parseInt(url.port, 10) : defaultPort;
    const db_name = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const username = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");

    let ssl_mode: SslMode = "prefer";
    const sslParam =
      url.searchParams.get("sslmode") ||
      url.searchParams.get("ssl_mode") ||
      url.searchParams.get("ssl-mode") ||
      url.searchParams.get("ssl");

    if (sslParam) {
      const lower = sslParam.toLowerCase();
      if (["require", "true", "1"].includes(lower)) ssl_mode = "require";
      else if (["disable", "false", "0"].includes(lower)) ssl_mode = "disable";
      else if (["verify-full", "verify_full"].includes(lower)) ssl_mode = "verify-full";
      else if (["verify-ca", "verify_ca"].includes(lower)) ssl_mode = "verify-ca";
      else if (lower === "allow") ssl_mode = "allow";
      else if (lower === "prefer") ssl_mode = "prefer";
    }

    return { engine, host, port, db_name, username, password, ssl_mode };
  } catch {
    return null;
  }
}

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
  if (values.ssh_enabled && values.ssh_password && payload.ssh_config) {
    payload.ssh_config.password = values.ssh_password;
  }
  return payload;
}

export function ConnectionForm({
  connection,
  onSaved,
}: {
  connection?: Connection | null;
  onSaved: () => void;
}) {
  // Always allow toggling between Database URL and Manual Parameters
  const [mode, setMode] = useState<"url" | "params">("url");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [urlName, setUrlName] = useState(connection?.name ?? "");
  const [urlReadOnly, setUrlReadOnly] = useState(connection?.read_only ?? false);

  const [serverError, setServerError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, trigger, getValues, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(connection),
  });

  useEffect(() => {
    reset(defaultsFor(connection));
    setDatabaseUrl("");
    setUrlName(connection?.name ?? "");
    setUrlReadOnly(connection?.read_only ?? false);
    setTestResult(null);
    setServerError(null);
    // If editing existing connection with credentials, start on params, but user can toggle anytime
    setMode(connection ? "params" : "url");
  }, [connection, reset]);

  const sshEnabled = watch("ssh_enabled");
  const passwordValue = watch("password");

  // Client-side parse of Database URL for immediate feedback & pre-filling
  const parsedUrl = useMemo(() => parseDatabaseUrlClient(databaseUrl), [databaseUrl]);

  // When a valid URL is typed, synchronize the form values so switching to "Manual Parameters" is seamless
  useEffect(() => {
    if (parsedUrl) {
      setValue("engine", parsedUrl.engine);
      setValue("host", parsedUrl.host);
      setValue("port", String(parsedUrl.port));
      setValue("db_name", parsedUrl.db_name);
      setValue("username", parsedUrl.username);
      if (parsedUrl.password) setValue("password", parsedUrl.password);
      setValue("ssl_mode", parsedUrl.ssl_mode);

      if (!urlName && parsedUrl.db_name) {
        setValue("name", `${parsedUrl.db_name} (${parsedUrl.host})`);
      }
    }
  }, [parsedUrl, setValue, urlName]);

  async function onSubmitUrl(e: React.FormEvent) {
    e.preventDefault();
    if (!databaseUrl.trim()) {
      setServerError("Please enter a database connection URL.");
      return;
    }
    setServerError(null);
    try {
      const finalName = urlName.trim() || (parsedUrl ? `${parsedUrl.db_name} (${parsedUrl.host})` : "database");
      const payload: ConnectionPayload = {
        name: finalName,
        database_url: databaseUrl.trim(),
        read_only: urlReadOnly,
      };
      if (connection) {
        await apiPatch(`/connections/${connection.id}/`, payload);
      } else {
        await apiPost("/connections/", payload);
      }
      onSaved();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Saving connection failed");
    }
  }

  async function onTestUrl() {
    if (!databaseUrl.trim()) {
      setServerError("Please enter a database connection URL to test.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setServerError(null);
    try {
      const result = await apiPost<TestResult>("/connections/test/", {
        database_url: databaseUrl.trim(),
        name: urlName.trim() || "test",
        read_only: urlReadOnly,
      });
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

  async function onSubmitParams(values: FormValues) {
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

  async function onTestParams() {
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
    <DialogContent className="max-w-2xl bg-[#121215] border border-zinc-800 text-zinc-100 shadow-2xl p-6 sm:p-7 rounded-2xl">
      <DialogHeader>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HugeiconsIcon icon={DatabaseIcon} className="size-4" />
          </div>
          <DialogTitle className="text-lg font-semibold text-white tracking-tight">
            {connection ? "Edit database connection" : "Add database connection"}
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-zinc-400">
          Connect your PostgreSQL or MySQL database. Credentials are encrypted at rest with Fernet.
        </DialogDescription>
      </DialogHeader>

      {/* Prominent Mode Switcher Tabs (Always visible for both new and edit connections) */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#18181c] border border-zinc-800 rounded-xl my-1">
        <button
          type="button"
          onClick={() => {
            setMode("url");
            setTestResult(null);
            setServerError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mode === "url"
              ? "bg-zinc-800 text-white shadow-md border border-zinc-700/80"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <HugeiconsIcon icon={Link02Icon} className={`size-4 ${mode === "url" ? "text-emerald-400" : "text-zinc-400"}`} />
          <div className="flex items-center gap-1.5">
            <span>Database URL</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Fast
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("params");
            setTestResult(null);
            setServerError(null);
          }}
          className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mode === "params"
              ? "bg-zinc-800 text-white shadow-md border border-zinc-700/80"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
          }`}
        >
          <HugeiconsIcon icon={SlidersHorizontalIcon} className={`size-4 ${mode === "params" ? "text-emerald-400" : "text-zinc-400"}`} />
          <span>Manual Parameters</span>
        </button>
      </div>

      {/* Error & Test Feedback Banners */}
      {serverError && <Alert variant="destructive" className="bg-red-950/40 border-red-500/30 text-red-300">{serverError}</Alert>}
      {testResult &&
        (testResult.ok ? (
          <Alert variant="success" className="bg-emerald-950/40 border-emerald-500/30 text-emerald-300">
            Connected successfully in {testResult.latency_ms} ms — {testResult.server_version}
          </Alert>
        ) : (
          <Alert variant="destructive" className="bg-red-950/40 border-red-500/30 text-red-300">
            {testResult.error}
          </Alert>
        ))}

      {/* TAB 1: Database URL Mode */}
      {mode === "url" && (
        <form onSubmit={onSubmitUrl} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="database_url" className="text-xs font-medium text-zinc-300">
                Database Connection String / URL
              </Label>
              <span className="text-[11px] text-zinc-500 font-mono">
                postgresql:// or mysql://
              </span>
            </div>

            <textarea
              id="database_url"
              rows={3}
              value={databaseUrl}
              onChange={(e) => {
                setDatabaseUrl(e.target.value);
                setServerError(null);
              }}
              placeholder="postgresql://username:password@ep-host.aws.neon.tech:5432/dbname?sslmode=require"
              className="w-full rounded-lg border border-zinc-800 bg-[#18181c] p-3 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors resize-none"
            />

            {/* Live Parser Feedback */}
            {parsedUrl ? (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs select-none">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px]">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3" />
                  {parsedUrl.engine === "postgres" ? "PostgreSQL" : "MySQL"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-mono">
                  {parsedUrl.host}:{parsedUrl.port}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 font-mono">
                  db: {parsedUrl.db_name}
                </span>
                {parsedUrl.username && (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
                    user: {parsedUrl.username}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
                  ssl: {parsedUrl.ssl_mode}
                </span>
              </div>
            ) : databaseUrl.trim() ? (
              <p className="text-[11px] text-amber-400/80">
                Enter a full URL including scheme (e.g. postgresql://user:pass@host:5432/db)
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="url_name" className="text-xs font-medium text-zinc-300">
              Connection Name <span className="text-zinc-500">(Optional)</span>
            </Label>
            <Input
              id="url_name"
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
              placeholder={parsedUrl ? `${parsedUrl.db_name} (${parsedUrl.host})` : "production-db"}
              className="bg-[#18181c] border-zinc-800 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-xs text-zinc-300 select-none pt-1">
            <input
              type="checkbox"
              checked={urlReadOnly}
              onChange={(e) => setUrlReadOnly(e.target.checked)}
              className="size-4 rounded accent-emerald-500 border-zinc-700 bg-zinc-900"
            />
            <span>Read-only connection (enforced by the database engine)</span>
          </label>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setMode("params")}
              className="text-[11px] text-zinc-400 hover:text-emerald-400 underline underline-offset-4 cursor-pointer transition-colors"
            >
              Need SSH tunnel or individual fields? Switch to Manual Parameters →
            </button>
          </div>

          <DialogFooter className="items-center gap-2 pt-2 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="outline"
              onClick={onTestUrl}
              disabled={testing || !databaseUrl.trim()}
              className="bg-zinc-900/80 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              {testing ? <Spinner className="size-3.5 text-emerald-400" /> : <HugeiconsIcon icon={PlayIcon} className="size-3.5" />}
              <span>Test connection</span>
            </Button>
            <Button
              type="submit"
              disabled={!databaseUrl.trim() || testing}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {connection ? "Update from URL" : "Add connection"}
            </Button>
          </DialogFooter>
        </form>
      )}

      {/* TAB 2: Manual Parameters Mode */}
      {mode === "params" && (
        <form onSubmit={handleSubmit(onSubmitParams)} className="grid gap-4" noValidate>
          {/* Quick Notice to Switch to Database URL */}
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-xs">
            <span className="text-zinc-400 text-[11.5px]">Have a database connection string?</span>
            <button
              type="button"
              onClick={() => setMode("url")}
              className="text-emerald-400 hover:text-emerald-300 font-medium text-xs cursor-pointer flex items-center gap-1"
            >
              <HugeiconsIcon icon={Link02Icon} className="size-3" />
              <span>Use Database URL</span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="name" className="text-xs font-medium text-zinc-300">Name</Label>
              <Input
                id="name"
                placeholder="production-db"
                {...register("name")}
                className="bg-[#18181c] border-zinc-800 text-zinc-100 placeholder:text-zinc-600"
              />
              <FieldError message={formState.errors.name?.message} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="engine" className="text-xs font-medium text-zinc-300">Engine</Label>
              <select
                id="engine"
                className="flex h-9 w-full rounded-md border border-zinc-800 bg-[#18181c] px-3 text-xs text-zinc-100 shadow-sm focus-visible:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
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
              <Label htmlFor="ssl_mode" className="text-xs font-medium text-zinc-300">SSL mode</Label>
              <select
                id="ssl_mode"
                className="flex h-9 w-full rounded-md border border-zinc-800 bg-[#18181c] px-3 text-xs text-zinc-100 shadow-sm focus-visible:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                {...register("ssl_mode")}
              >
                {SSL_MODES.map((ssl) => (
                  <option key={ssl} value={ssl}>
                    {ssl}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="host" className="text-xs font-medium text-zinc-300">Host</Label>
              <Input
                id="host"
                placeholder="db.example.com"
                {...register("host")}
                className="bg-[#18181c] border-zinc-800 text-zinc-100 font-mono text-xs placeholder:text-zinc-600"
              />
              <FieldError message={formState.errors.host?.message} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="port" className="text-xs font-medium text-zinc-300">Port</Label>
              <Input
                id="port"
                inputMode="numeric"
                {...register("port")}
                className="bg-[#18181c] border-zinc-800 text-zinc-100 font-mono text-xs"
              />
              <FieldError message={formState.errors.port?.message} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="db_name" className="text-xs font-medium text-zinc-300">Database</Label>
              <Input
                id="db_name"
                placeholder="appdb"
                {...register("db_name")}
                className="bg-[#18181c] border-zinc-800 text-zinc-100 font-mono text-xs"
              />
              <FieldError message={formState.errors.db_name?.message} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username" className="text-xs font-medium text-zinc-300">Username</Label>
              <Input
                id="username"
                autoComplete="off"
                {...register("username")}
                className="bg-[#18181c] border-zinc-800 text-zinc-100 font-mono text-xs"
              />
              <FieldError message={formState.errors.username?.message} />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="password" className="text-xs font-medium text-zinc-300">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder={connection ? "Leave blank to keep stored password" : "Password"}
                {...register("password")}
                className="bg-[#18181c] border-zinc-800 text-zinc-100 font-mono text-xs"
              />
              <FieldError message={formState.errors.password?.message} />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-xs text-zinc-300 select-none">
            <input
              type="checkbox"
              className="size-4 rounded accent-emerald-500 border-zinc-700 bg-zinc-900"
              {...register("read_only")}
            />
            <span>Read-only connection (enforced by the database engine)</span>
          </label>

          {/* SSH Tunnel Options */}
          <div className="rounded-xl border border-zinc-800/80 bg-[#16161a]/60 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-200 select-none">
              <input
                type="checkbox"
                className="size-4 rounded accent-emerald-500 border-zinc-700 bg-zinc-900"
                {...register("ssh_enabled")}
              />
              <span>Connect through SSH tunnel</span>
            </label>
            {sshEnabled && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="ssh_host" className="text-[11px] text-zinc-400">SSH host</Label>
                  <Input
                    id="ssh_host"
                    placeholder="bastion.example.com"
                    {...register("ssh_host")}
                    className="bg-[#18181c] border-zinc-800 text-xs font-mono"
                  />
                  <FieldError message={formState.errors.ssh_host?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ssh_port" className="text-[11px] text-zinc-400">SSH port</Label>
                  <Input
                    id="ssh_port"
                    inputMode="numeric"
                    defaultValue={22}
                    {...register("ssh_port")}
                    className="bg-[#18181c] border-zinc-800 text-xs font-mono"
                  />
                  <FieldError message={formState.errors.ssh_port?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ssh_username" className="text-[11px] text-zinc-400">SSH username</Label>
                  <Input
                    id="ssh_username"
                    autoComplete="off"
                    {...register("ssh_username")}
                    className="bg-[#18181c] border-zinc-800 text-xs font-mono"
                  />
                  <FieldError message={formState.errors.ssh_username?.message} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="ssh_password" className="text-[11px] text-zinc-400">SSH password</Label>
                  <Input
                    id="ssh_password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={connection ? "Leave blank to keep stored password" : "SSH password"}
                    {...register("ssh_password")}
                    className="bg-[#18181c] border-zinc-800 text-xs font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="items-center gap-2 pt-2 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="outline"
              onClick={onTestParams}
              disabled={testing || formState.isSubmitting}
              className="bg-zinc-900/80 border-zinc-700 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              {testing ? <Spinner className="size-3.5 text-emerald-400" /> : <HugeiconsIcon icon={PlayIcon} className="size-3.5" />}
              <span>Test connection</span>
            </Button>
            <Button
              type="submit"
              disabled={formState.isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              {formState.isSubmitting && <Spinner className="size-3.5" />}
              {connection ? "Save changes" : "Add connection"}
            </Button>
          </DialogFooter>
          {usingStoredPassword && (
            <p className="text-right text-[11px] text-zinc-500 font-mono">
              Testing uses stored password because none was re-entered.
            </p>
          )}
        </form>
      )}
    </DialogContent>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  DatabaseIcon,
  Link02Icon,
  PlayIcon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";

import { Spinner } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FieldError, Input, Label } from "@/components/ui/input";
import { api, apiPost, apiPatch } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
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

const manualSchema = z
  .object({
    name: z.string().optional(),
    engine: z.enum(["postgres", "mysql"]),
    host: z.string().min(1, "Host is required"),
    port: z.string().regex(/^\d+$/, "Port must be a number"),
    db_name: z.string().min(1, "Database name is required"),
    username: z.string().optional(),
    password: z.string().optional(),
    ssl_mode: z.enum(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]),
    read_only: z.boolean(),
    environment: z.enum(["development", "staging", "production"]),
    require_approval: z.boolean(),
    ssh_enabled: z.boolean(),
    ssh_host: z.string().optional(),
    ssh_port: z.string().optional(),
    ssh_username: z.string().optional(),
    ssh_password: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (!values.ssh_enabled) return;
    if (!values.ssh_host) {
      ctx.addIssue({ code: "custom", path: ["ssh_host"], message: "SSH host is required" });
    }
    if (!values.ssh_username) {
      ctx.addIssue({ code: "custom", path: ["ssh_username"], message: "SSH username is required" });
    }
    if (values.ssh_port && !/^\d+$/.test(values.ssh_port)) {
      ctx.addIssue({ code: "custom", path: ["ssh_port"], message: "Port must be a number" });
    }
  });

type FormValues = z.infer<typeof manualSchema>;

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
    environment: connection?.environment ?? "development",
    require_approval: connection?.require_approval ?? false,
    ssh_enabled: connection?.ssh_config?.enabled ?? false,
    ssh_host: connection?.ssh_config?.host ?? "",
    ssh_port: String(connection?.ssh_config?.port ?? 22),
    ssh_username: connection?.ssh_config?.username ?? "",
    ssh_password: "",
  };
}

export function ConnectionForm({
  connection,
  onSaved,
}: {
  connection?: Connection | null;
  onSaved: () => void;
}) {
  // Mode: "url" (connection string) or "params" (manual fields)
  const [mode, setMode] = useState<"url" | "params">("url");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [urlName, setUrlName] = useState(connection?.name ?? "");
  const [urlReadOnly, setUrlReadOnly] = useState(connection?.read_only ?? false);
  const [urlEnvironment, setUrlEnvironment] = useState<"development" | "staging" | "production">(
    connection?.environment ?? "development"
  );
  const [urlRequireApproval, setUrlRequireApproval] = useState(
    connection?.require_approval ?? false
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const setActiveConnectionId = useWorkspaceStore((s) => s.setActiveConnectionId);

  const { register, handleSubmit, reset, watch, setValue, trigger, getValues, formState } = useForm<FormValues>({
    resolver: zodResolver(manualSchema),
    defaultValues: defaultsFor(connection),
  });

  const selectedEngine = watch("engine");
  const sshEnabled = watch("ssh_enabled");

  useEffect(() => {
    reset(defaultsFor(connection));
    setDatabaseUrl("");
    setUrlName(connection?.name ?? "");
    setUrlReadOnly(connection?.read_only ?? false);
    setUrlEnvironment(connection?.environment ?? "development");
    setUrlRequireApproval(connection?.require_approval ?? false);
    setTestResult(null);
    setServerError(null);
    setShowAdvanced(Boolean(connection?.ssh_config?.enabled));
    setMode(connection ? "params" : "url");
  }, [connection, reset]);

  // Client-side parse of Database URL for live feedback & field sync
  const parsedUrl = useMemo(() => parseDatabaseUrlClient(databaseUrl), [databaseUrl]);

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

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = databaseUrl.trim();
    if (!trimmed) {
      setServerError("Please enter a database connection string.");
      return;
    }
    setSaving(true);
    setServerError(null);
    try {
      const finalName = urlName.trim() || (parsedUrl ? `${parsedUrl.db_name} (${parsedUrl.host})` : "database");
      const payload: ConnectionPayload = {
        name: finalName,
        database_url: trimmed,
        read_only: urlReadOnly,
        environment: urlEnvironment,
        is_production: urlEnvironment === "production",
        require_approval: urlRequireApproval,
      };
      if (connection) {
        await apiPatch(`/connections/${connection.id}/`, payload);
      } else {
        const created = await apiPost<Connection>("/connections/", payload);
        if (created?.id) {
          setActiveConnectionId(created.id);
        }
      }
      onSaved();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save connection");
    } finally {
      setSaving(false);
    }
  }

  async function handleUrlTest() {
    const trimmed = databaseUrl.trim();
    if (!trimmed) {
      setServerError("Enter a connection string to test.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    setServerError(null);
    try {
      const result = await apiPost<TestResult>("/connections/test/", {
        database_url: trimmed,
        name: urlName.trim() || "test",
        read_only: urlReadOnly,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Connection failed",
        latency_ms: null,
        server_version: null,
      });
    } finally {
      setTesting(false);
    }
  }

  function buildPayloadFromManual(values: FormValues): ConnectionPayload {
    const finalName = values.name?.trim() || `${values.db_name} (${values.host})`;
    const payload: ConnectionPayload = {
      name: finalName,
      engine: values.engine,
      host: values.host.trim(),
      port: Number(values.port),
      db_name: values.db_name.trim(),
      username: values.username?.trim() ?? "",
      ssl_mode: values.ssl_mode,
      read_only: values.read_only,
      environment: values.environment,
      is_production: values.environment === "production",
      require_approval: values.require_approval,
      ssh_config: {
        enabled: values.ssh_enabled,
        host: values.ssh_host?.trim() ?? "",
        port: Number(values.ssh_port || 22),
        username: values.ssh_username?.trim() ?? "",
      },
    };
    if (values.password) payload.password = values.password;
    if (values.ssh_enabled && values.ssh_password && payload.ssh_config) {
      payload.ssh_config.password = values.ssh_password;
    }
    return payload;
  }

  async function handleManualSubmit(values: FormValues) {
    setSaving(true);
    setServerError(null);
    try {
      const payload = buildPayloadFromManual(values);
      if (connection) {
        await apiPatch(`/connections/${connection.id}/`, payload);
      } else {
        const created = await apiPost<Connection>("/connections/", payload);
        if (created?.id) {
          setActiveConnectionId(created.id);
        }
      }
      onSaved();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to save connection");
    } finally {
      setSaving(false);
    }
  }

  async function handleManualTest() {
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
          : await apiPost<TestResult>("/connections/test/", buildPayloadFromManual(values));
      setTestResult(result);
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : "Connection failed",
        latency_ms: null,
        server_version: null,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <DialogContent className="max-w-md sm:max-w-lg bg-[#121215] border border-zinc-800 text-zinc-100 shadow-2xl p-6 rounded-2xl gap-5">
      {/* Header */}
      <DialogHeader className="gap-1">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HugeiconsIcon icon={DatabaseIcon} className="size-4" />
          </div>
          <DialogTitle className="text-base font-semibold text-white tracking-tight">
            {connection ? "Edit database connection" : "Add database connection"}
          </DialogTitle>
        </div>
        <DialogDescription className="text-xs text-zinc-400">
          Connect your PostgreSQL or MySQL database. Credentials are encrypted at rest.
        </DialogDescription>
      </DialogHeader>

      {/* Sleek Segmented Mode Switcher */}
      <div className="flex p-0.5 rounded-lg bg-[#18181c] border border-zinc-800/90 text-xs select-none">
        <button
          type="button"
          onClick={() => {
            setMode("url");
            setTestResult(null);
            setServerError(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
            mode === "url"
              ? "bg-zinc-800 text-white shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <HugeiconsIcon icon={Link02Icon} className="size-3.5" />
          <span>Connection String</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("params");
            setTestResult(null);
            setServerError(null);
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all cursor-pointer ${
            mode === "params"
              ? "bg-zinc-800 text-white shadow-xs"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <HugeiconsIcon icon={SlidersHorizontalIcon} className="size-3.5" />
          <span>Manual Fields</span>
        </button>
      </div>

      {/* Inline Feedback Banner (Testing / Error / Success) */}
      {serverError && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0 mt-0.5" />
          <span className="leading-snug">{serverError}</span>
        </div>
      )}

      {testResult && (
        <div
          className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
            testResult.ok
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}
        >
          <HugeiconsIcon
            icon={testResult.ok ? CheckmarkCircle02Icon : AlertCircleIcon}
            className="size-4 shrink-0 mt-0.5"
          />
          <div className="leading-snug">
            {testResult.ok ? (
              <span>
                Connected in <strong className="font-mono">{testResult.latency_ms} ms</strong> — {testResult.server_version}
              </span>
            ) : (
              <span>{testResult.error || "Connection failed"}</span>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1: Connection String (Default) */}
      {mode === "url" && (
        <form onSubmit={handleUrlSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="database_url" className="text-xs font-medium text-zinc-300">
                Connection string
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
                setTestResult(null);
              }}
              placeholder="postgresql://user:password@host:5432/dbname"
              className="w-full rounded-lg border border-zinc-800 bg-[#18181c] p-2.5 text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/80 transition-colors resize-none leading-relaxed"
            />

            {/* Subtle URL Feedback */}
            {parsedUrl ? (
              <p className="text-[11px] text-emerald-400/90 font-mono flex items-center gap-1.5 pt-0.5">
                <span className="inline-block size-1.5 rounded-full bg-emerald-400" />
                {parsedUrl.engine === "postgres" ? "PostgreSQL" : "MySQL"} · {parsedUrl.host} · {parsedUrl.db_name}
              </p>
            ) : databaseUrl.trim() ? (
              <p className="text-[11px] text-zinc-400 pt-0.5">
                Format: <code className="text-zinc-300">engine://user:password@host:port/database</code>
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="url_name" className="text-xs font-medium text-zinc-300">
              Name <span className="text-zinc-500 font-normal">(optional)</span>
            </Label>
            <Input
              id="url_name"
              value={urlName}
              onChange={(e) => setUrlName(e.target.value)}
              placeholder={parsedUrl ? `${parsedUrl.db_name} (${parsedUrl.host})` : "e.g. Production Database"}
              className="bg-[#18181c] border-zinc-800 text-xs h-9 placeholder:text-zinc-600 focus:border-emerald-500/80"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 select-none">
              <input
                type="checkbox"
                checked={urlReadOnly}
                onChange={(e) => setUrlReadOnly(e.target.checked)}
                className="size-3.5 rounded accent-emerald-500 border-zinc-700 bg-zinc-900"
              />
              <span>Read-only mode</span>
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 select-none">
              <input
                type="checkbox"
                checked={urlRequireApproval}
                onChange={(e) => setUrlRequireApproval(e.target.checked)}
                className="size-3.5 rounded accent-amber-500 border-zinc-700 bg-zinc-900"
              />
              <span>Require write approval</span>
            </label>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="url_env" className="text-xs font-medium text-zinc-300">Environment</Label>
            <select
              id="url_env"
              value={urlEnvironment}
              onChange={(e) => setUrlEnvironment(e.target.value as "development" | "staging" | "production")}
              className="flex h-9 w-full rounded-md border border-zinc-800 bg-[#18181c] px-2.5 text-xs text-zinc-200 shadow-sm focus:border-emerald-500/80 transition-colors cursor-pointer"
            >
              <option value="development">Development</option>
              <option value="staging">Staging</option>
              <option value="production">Production</option>
            </select>
          </div>

          <DialogFooter className="items-center justify-between sm:justify-between gap-2 pt-3 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="outline"
              onClick={handleUrlTest}
              disabled={testing || saving || !databaseUrl.trim()}
              className="bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs h-9 cursor-pointer transition-colors"
            >
              {testing ? <Spinner className="size-3.5 text-emerald-400" /> : <HugeiconsIcon icon={PlayIcon} className="size-3.5 text-zinc-400" />}
              <span>Test</span>
            </Button>

            <Button
              type="submit"
              disabled={saving || testing || !databaseUrl.trim()}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs h-9 px-4 cursor-pointer shadow-md shadow-emerald-500/10 transition-all"
            >
              {saving && <Spinner className="size-3.5 text-zinc-950" />}
              <span>{connection ? "Save Changes" : "Connect"}</span>
            </Button>
          </DialogFooter>
        </form>
      )}

      {/* VIEW 2: Manual Fields */}
      {mode === "params" && (
        <form onSubmit={handleSubmit(handleManualSubmit)} className="grid gap-3.5" noValidate>
          {/* Engine Selector Pills */}
          <div className="grid gap-1.5">
            <Label className="text-xs font-medium text-zinc-300">Database Engine</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue("engine", "postgres");
                  setValue("port", "5432");
                }}
                className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedEngine === "postgres"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-[#18181c] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>PostgreSQL</span>
                <span className="text-[10px] text-zinc-500 font-mono">(5432)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue("engine", "mysql");
                  setValue("port", "3306");
                }}
                className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  selectedEngine === "mysql"
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                    : "bg-[#18181c] border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span>MySQL</span>
                <span className="text-[10px] text-zinc-500 font-mono">(3306)</span>
              </button>
            </div>
          </div>

          {/* Host & Port Row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="host" className="text-xs font-medium text-zinc-300">Host</Label>
              <Input
                id="host"
                placeholder="aws.neon.tech"
                {...register("host")}
                className="bg-[#18181c] border-zinc-800 text-xs font-mono h-9 placeholder:text-zinc-600"
              />
              <FieldError message={formState.errors.host?.message} />
            </div>

            <div className="col-span-1 grid gap-1.5">
              <Label htmlFor="port" className="text-xs font-medium text-zinc-300">Port</Label>
              <Input
                id="port"
                inputMode="numeric"
                {...register("port")}
                className="bg-[#18181c] border-zinc-800 text-xs font-mono h-9 placeholder:text-zinc-600"
              />
              <FieldError message={formState.errors.port?.message} />
            </div>
          </div>

          {/* Database & Username Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="db_name" className="text-xs font-medium text-zinc-300">Database</Label>
              <Input
                id="db_name"
                placeholder="neondb"
                {...register("db_name")}
                className="bg-[#18181c] border-zinc-800 text-xs font-mono h-9 placeholder:text-zinc-600"
              />
              <FieldError message={formState.errors.db_name?.message} />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="username" className="text-xs font-medium text-zinc-300">Username</Label>
              <Input
                id="username"
                autoComplete="off"
                placeholder="user"
                {...register("username")}
                className="bg-[#18181c] border-zinc-800 text-xs font-mono h-9 placeholder:text-zinc-600"
              />
              <FieldError message={formState.errors.username?.message} />
            </div>
          </div>

          {/* Password */}
          <div className="grid gap-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-zinc-300">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder={connection ? "Leave blank to keep current password" : "••••••••"}
              {...register("password")}
              className="bg-[#18181c] border-zinc-800 text-xs font-mono h-9 placeholder:text-zinc-600"
            />
            <FieldError message={formState.errors.password?.message} />
          </div>

          {/* Name (Optional) */}
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-xs font-medium text-zinc-300">
              Name <span className="text-zinc-500 font-normal">(optional)</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Analytics DB"
              {...register("name")}
              className="bg-[#18181c] border-zinc-800 text-xs h-9 placeholder:text-zinc-600"
            />
          </div>

          {/* Collapsible Advanced Settings (SSL, SSH, Read-only) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer select-none py-1"
            >
              <HugeiconsIcon
                icon={showAdvanced ? ArrowDown01Icon : ArrowRight01Icon}
                className="size-3.5 text-zinc-500"
              />
              <span>Advanced options (SSL, SSH tunnel, Read-only)</span>
            </button>

            {showAdvanced && (
              <div className="mt-2.5 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/80 grid gap-3 text-xs">
                {/* SSL Mode */}
                <div className="grid gap-1.5">
                  <Label htmlFor="ssl_mode" className="text-[11px] text-zinc-400">SSL mode</Label>
                  <select
                    id="ssl_mode"
                    className="flex h-8 w-full rounded-md border border-zinc-800 bg-[#18181c] px-2.5 text-xs text-zinc-200 shadow-sm focus-visible:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                    {...register("ssl_mode")}
                  >
                    {SSL_MODES.map((ssl) => (
                      <option key={ssl} value={ssl}>
                        {ssl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Environment Selector */}
                <div className="grid gap-1.5">
                  <Label htmlFor="environment" className="text-[11px] text-zinc-400">Environment</Label>
                  <select
                    id="environment"
                    className="flex h-8 w-full rounded-md border border-zinc-800 bg-[#18181c] px-2.5 text-xs text-zinc-200 shadow-sm focus-visible:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                    {...register("environment")}
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>

                {/* Require Peer Approval */}
                <label className="flex cursor-pointer items-start gap-2 text-zinc-400 select-none">
                  <input
                    type="checkbox"
                    className="size-3.5 mt-0.5 rounded accent-amber-500 border-zinc-700 bg-zinc-900"
                    {...register("require_approval")}
                  />
                  <div>
                    <span className="text-zinc-200">Require peer approval for writes</span>
                    <p className="text-[10px] text-zinc-500">Mutations become change requests requiring peer review.</p>
                  </div>
                </label>

                {/* Read-only Checkbox */}
                <label className="flex cursor-pointer items-center gap-2 text-zinc-400 select-none">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded accent-emerald-500 border-zinc-700 bg-zinc-900"
                    {...register("read_only")}
                  />
                  <span>Read-only connection</span>
                </label>

                {/* SSH Tunnel */}
                <div className="pt-1 border-t border-zinc-800/60">
                  <label className="flex cursor-pointer items-center gap-2 font-medium text-zinc-300 select-none">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded accent-emerald-500 border-zinc-700 bg-zinc-900"
                      {...register("ssh_enabled")}
                    />
                    <span>Connect through SSH tunnel</span>
                  </label>

                  {sshEnabled && (
                    <div className="mt-2.5 grid grid-cols-2 gap-2 pt-1">
                      <div className="grid gap-1">
                        <Label htmlFor="ssh_host" className="text-[10px] text-zinc-500">SSH host</Label>
                        <Input
                          id="ssh_host"
                          placeholder="bastion.example.com"
                          {...register("ssh_host")}
                          className="bg-[#18181c] border-zinc-800 text-xs font-mono h-8"
                        />
                        <FieldError message={formState.errors.ssh_host?.message} />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="ssh_port" className="text-[10px] text-zinc-500">SSH port</Label>
                        <Input
                          id="ssh_port"
                          inputMode="numeric"
                          defaultValue={22}
                          {...register("ssh_port")}
                          className="bg-[#18181c] border-zinc-800 text-xs font-mono h-8"
                        />
                        <FieldError message={formState.errors.ssh_port?.message} />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="ssh_username" className="text-[10px] text-zinc-500">SSH username</Label>
                        <Input
                          id="ssh_username"
                          autoComplete="off"
                          placeholder="ubuntu"
                          {...register("ssh_username")}
                          className="bg-[#18181c] border-zinc-800 text-xs font-mono h-8"
                        />
                        <FieldError message={formState.errors.ssh_username?.message} />
                      </div>
                      <div className="grid gap-1">
                        <Label htmlFor="ssh_password" className="text-[10px] text-zinc-500">SSH password</Label>
                        <Input
                          id="ssh_password"
                          type="password"
                          autoComplete="new-password"
                          placeholder={connection ? "Leave blank to keep" : "Password"}
                          {...register("ssh_password")}
                          className="bg-[#18181c] border-zinc-800 text-xs font-mono h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="items-center justify-between sm:justify-between gap-2 pt-3 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="outline"
              onClick={handleManualTest}
              disabled={testing || saving || formState.isSubmitting}
              className="bg-zinc-900/80 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs h-9 cursor-pointer transition-colors"
            >
              {testing ? <Spinner className="size-3.5 text-emerald-400" /> : <HugeiconsIcon icon={PlayIcon} className="size-3.5 text-zinc-400" />}
              <span>Test</span>
            </Button>

            <Button
              type="submit"
              disabled={saving || testing || formState.isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs h-9 px-4 cursor-pointer shadow-md shadow-emerald-500/10 transition-all"
            >
              {(saving || formState.isSubmitting) && <Spinner className="size-3.5 text-zinc-950" />}
              <span>{connection ? "Save Changes" : "Connect"}</span>
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}

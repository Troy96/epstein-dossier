"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Database,
  HardDrive,
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Palette,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { getDocumentStats } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { THEMES, type ThemeId } from "@/lib/themes";

interface ServiceStatus {
  name: string;
  status: "online" | "offline" | "unknown";
  details?: string;
}

export function SettingsView() {
  const [stats, setStats] = useState<{
    total: number;
    by_status: Record<string, number>;
    with_images: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "PostgreSQL", status: "unknown" },
    { name: "Meilisearch", status: "unknown" },
    { name: "API Server", status: "unknown" },
  ]);

  useEffect(() => {
    loadData();
    checkServices();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDocumentStats();
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkServices = async () => {
    // Check API server
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/documents/stats/summary`
      );
      setServices((prev) =>
        prev.map((s) =>
          s.name === "API Server"
            ? { ...s, status: response.ok ? "online" : "offline" }
            : s.name === "PostgreSQL"
            ? { ...s, status: response.ok ? "online" : "unknown" }
            : s
        )
      );
    } catch {
      setServices((prev) =>
        prev.map((s) =>
          s.name === "API Server" ? { ...s, status: "offline" } : s
        )
      );
    }

    // Check Meilisearch
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_MEILI_URL || "http://localhost:7700"}/health`
      );
      setServices((prev) =>
        prev.map((s) =>
          s.name === "Meilisearch"
            ? { ...s, status: response.ok ? "online" : "offline" }
            : s
        )
      );
    } catch {
      setServices((prev) =>
        prev.map((s) =>
          s.name === "Meilisearch" ? { ...s, status: "offline" } : s
        )
      );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "online":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "offline":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-500/20 text-green-500">Online</Badge>;
      case "offline":
        return <Badge className="bg-red-500/20 text-red-500">Offline</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const { themeId, setTheme } = useTheme();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {THEMES.map((t) => {
              const active = themeId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                    active
                      ? "border-[var(--ring)] ring-1 ring-[var(--ring)]"
                      : "border-transparent hover:border-[var(--border)]"
                  }`}
                  style={{ backgroundColor: t.vars["--card"] }}
                >
                  {active && (
                    <div
                      className="absolute top-2 right-2 rounded-full p-0.5"
                      style={{ backgroundColor: t.vars["--primary"] }}
                    >
                      <Check className="h-3 w-3" style={{ color: t.vars["--primary-foreground"] }} />
                    </div>
                  )}
                  <div className="flex gap-1.5 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: t.vars["--primary"] }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: t.vars["--accent"] }}
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: t.vars["--muted"] }}
                    />
                  </div>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: t.vars["--foreground"] }}
                  >
                    {t.name}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: t.vars["--muted-foreground"] }}
                  >
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <span className="font-medium">{service.name}</span>
                </div>
                {getStatusBadge(service.status)}
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={checkServices}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Status
          </Button>
        </CardContent>
      </Card>

      {/* Database Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <LoadingState message="Loading statistics..." />
          ) : stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">With Images</p>
                <p className="text-2xl font-bold">
                  {stats.with_images.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">OCR Completed</p>
                <p className="text-2xl font-bold">
                  {(stats.by_status?.completed || 0).toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  {(stats.by_status?.pending || 0).toLocaleString()}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">Unable to load statistics</p>
          )}
        </CardContent>
      </Card>

      {/* Storage Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">PDF Storage</span>
              <span>backend/data/pdfs/</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Images Storage</span>
              <span>backend/data/images/</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Faces Storage</span>
              <span>backend/data/faces/</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About Epstein Dossier</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            A comprehensive search platform for the DOJ-released Epstein files.
            Enables full-text search, entity extraction, and document analysis
            across 15,875+ documents.
          </p>
          <p>
            Built with Next.js, FastAPI, PostgreSQL, and Meilisearch.
          </p>
          <p className="pt-2">
            <a
              href="https://www.justice.gov/epstein"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              View source data on DOJ.gov
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

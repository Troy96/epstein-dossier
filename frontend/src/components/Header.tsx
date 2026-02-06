"use client";

import { Search, FileText, Menu } from "lucide-react";

interface HeaderProps {
  currentView: string;
  onSearch: () => void;
}

export function Header({ currentView, onSearch }: HeaderProps) {
  const viewTitles: Record<string, string> = {
    search: "Search Documents",
    document: "Document Viewer",
    entities: "Entity Explorer",
    faces: "Face Gallery",
    graph: "Connection Graph",
    timeline: "Timeline",
  };

  return (
    <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-accent" />
          <span className="font-bold text-lg">EPSTEIN DOSSIER</span>
        </div>
        <span className="text-muted-foreground">|</span>
        <h1 className="text-lg font-medium">{viewTitles[currentView] || "Search"}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSearch}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title="Quick Search"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

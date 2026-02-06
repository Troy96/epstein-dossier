"use client";

import {
  Search,
  FileText,
  Users,
  ScanFace,
  Network,
  Calendar,
  Bookmark,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewType = "search" | "documents" | "document" | "entities" | "faces" | "graph" | "timeline" | "bookmarks" | "settings";

interface SidebarProps {
  currentView: ViewType | string;
  onViewChange: (view: ViewType) => void;
}

const navItems = [
  { id: "search", label: "Search", icon: Search },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "entities", label: "Entities", icon: Users },
  { id: "faces", label: "Faces", icon: ScanFace },
  { id: "graph", label: "Graph", icon: Network },
  { id: "timeline", label: "Timeline", icon: Calendar },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-16 lg:w-56 bg-card border-r border-border flex flex-col">
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Also highlight "documents" when viewing a single document
            const isActive = currentView === item.id ||
              (item.id === "documents" && currentView === "document");
            return (
              <li key={item.id}>
                <button
                  onClick={() => onViewChange(item.id as ViewType)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="hidden lg:block">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-2 border-t border-border">
        <button
          onClick={() => onViewChange("bookmarks")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
            currentView === "bookmarks"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Bookmark className="h-5 w-5 flex-shrink-0" />
          <span className="hidden lg:block">Bookmarks</span>
        </button>
        <button
          onClick={() => onViewChange("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
            currentView === "settings"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Settings className="h-5 w-5 flex-shrink-0" />
          <span className="hidden lg:block">Settings</span>
        </button>
      </div>
    </aside>
  );
}

"use client";

import { usePathname, useRouter } from "next/navigation";
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

const navItems = [
  { id: "search", label: "Search", icon: Search, href: "/" },
  { id: "documents", label: "Documents", icon: FileText, href: "/documents" },
  { id: "entities", label: "Entities", icon: Users, href: "/entities" },
  { id: "faces", label: "Faces", icon: ScanFace, href: "/faces" },
  { id: "graph", label: "Graph", icon: Network, href: "/graph" },
  { id: "timeline", label: "Timeline", icon: Calendar, href: "/timeline" },
];

const bottomNavItems = [
  { id: "bookmarks", label: "Bookmarks", icon: Bookmark, href: "/bookmarks" },
  { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string, id: string) => {
    if (href === "/") return pathname === "/";
    if (id === "documents") return pathname === "/documents" || pathname.startsWith("/document/");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <aside className="w-16 lg:w-56 bg-card border-r border-border flex flex-col">
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                    active
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
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigation(item.href)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="hidden lg:block">{item.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

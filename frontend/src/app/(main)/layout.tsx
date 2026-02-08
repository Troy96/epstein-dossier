"use client";

import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { BackgroundEffects } from "@/components/BackgroundEffects";
import { usePathname, useRouter } from "next/navigation";

type ViewType = "search" | "documents" | "document" | "entities" | "faces" | "graph" | "timeline" | "discoveries" | "bookmarks" | "settings";

const pathToView: Record<string, ViewType> = {
  "/": "search",
  "/documents": "documents",
  "/entities": "entities",
  "/faces": "faces",
  "/graph": "graph",
  "/timeline": "timeline",
  "/discoveries": "discoveries",
  "/bookmarks": "bookmarks",
  "/settings": "settings",
};

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Determine current view from pathname
  const currentView: ViewType = pathname.startsWith("/document/")
    ? "document"
    : pathToView[pathname] || "search";

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header currentView={currentView} onSearch={() => router.push("/")} />
        <main className="flex-1 overflow-auto relative">
          <BackgroundEffects />
          <div className="relative z-[1] p-4">{children}</div>
        </main>
      </div>
    </div>
  );
}

"use client";

import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { usePathname, useRouter } from "next/navigation";

type ViewType = "search" | "documents" | "document" | "entities" | "faces" | "graph" | "timeline" | "bookmarks" | "settings";

const pathToView: Record<string, ViewType> = {
  "/": "search",
  "/documents": "documents",
  "/entities": "entities",
  "/faces": "faces",
  "/graph": "graph",
  "/timeline": "timeline",
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

  const handleViewChange = (view: ViewType) => {
    const routes: Record<ViewType, string> = {
      search: "/",
      documents: "/documents",
      document: "/documents",
      entities: "/entities",
      faces: "/faces",
      graph: "/graph",
      timeline: "/timeline",
      bookmarks: "/bookmarks",
      settings: "/settings",
    };
    router.push(routes[view]);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={handleViewChange} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header currentView={currentView} onSearch={() => router.push("/")} />
        <main className="flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}

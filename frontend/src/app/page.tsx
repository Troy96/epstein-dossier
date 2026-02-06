"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { SearchView } from "@/components/search/SearchView";
import { DocumentView } from "@/components/document/DocumentView";
import { DocumentsList } from "@/components/document/DocumentsList";
import { EntityExplorer } from "@/components/entity/EntityExplorer";
import { FaceGallery } from "@/components/face/FaceGallery";
import { GraphView } from "@/components/graph/GraphView";
import { TimelineView } from "@/components/timeline/TimelineView";
import { BookmarksView } from "@/components/bookmarks/BookmarksView";
import { SettingsView } from "@/components/settings/SettingsView";

type ViewType = "search" | "documents" | "document" | "entities" | "faces" | "graph" | "timeline" | "bookmarks" | "settings";

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewType>("search");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [selectedFaceId, setSelectedFaceId] = useState<number | null>(null);

  const handleDocumentSelect = (documentId: number) => {
    setSelectedDocumentId(documentId);
    setCurrentView("document");
  };

  const handleEntitySelect = (entityId: number) => {
    setSelectedEntityId(entityId);
    setCurrentView("entities");
  };

  const handleFaceSelect = (faceId: number) => {
    setSelectedFaceId(faceId);
    setCurrentView("faces");
  };

  const handleViewEntities = () => {
    setCurrentView("entities");
  };

  const handleViewFaces = () => {
    setCurrentView("faces");
  };

  const handleViewConnections = () => {
    setCurrentView("graph");
  };

  const renderView = () => {
    switch (currentView) {
      case "search":
        return (
          <SearchView
            onDocumentSelect={handleDocumentSelect}
            onEntitySelect={handleEntitySelect}
          />
        );
      case "documents":
        return (
          <DocumentsList
            onDocumentSelect={handleDocumentSelect}
          />
        );
      case "document":
        return (
          <DocumentView
            documentId={selectedDocumentId}
            onEntitySelect={handleEntitySelect}
            onFaceSelect={handleFaceSelect}
            onViewEntities={handleViewEntities}
            onViewFaces={handleViewFaces}
            onViewConnections={handleViewConnections}
          />
        );
      case "entities":
        return (
          <EntityExplorer
            selectedEntityId={selectedEntityId}
            onDocumentSelect={handleDocumentSelect}
            onEntitySelect={handleEntitySelect}
          />
        );
      case "faces":
        return (
          <FaceGallery
            selectedFaceId={selectedFaceId}
            onDocumentSelect={handleDocumentSelect}
            onFaceSelect={handleFaceSelect}
          />
        );
      case "graph":
        return (
          <GraphView
            documentId={selectedDocumentId}
            entityId={selectedEntityId}
            onDocumentSelect={handleDocumentSelect}
            onEntitySelect={handleEntitySelect}
          />
        );
      case "timeline":
        return (
          <TimelineView
            onDocumentSelect={handleDocumentSelect}
          />
        );
      case "bookmarks":
        return (
          <BookmarksView
            onDocumentSelect={handleDocumentSelect}
          />
        );
      case "settings":
        return <SettingsView />;
      default:
        return <SearchView onDocumentSelect={handleDocumentSelect} onEntitySelect={handleEntitySelect} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          currentView={currentView}
          onSearch={() => setCurrentView("search")}
        />
        <main className="flex-1 overflow-auto p-4">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

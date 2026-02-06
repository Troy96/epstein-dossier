// Re-export types from API for convenience
export type {
  SearchHit,
  SearchResponse,
  Document,
  DocumentListResponse,
  Entity,
  EntityListResponse,
  EntityDocumentsResponse,
  Face,
  FaceListResponse,
  FaceCluster,
  FaceClusterListResponse,
  FaceSimilarityResult,
  FaceSimilarityResponse,
  GraphNode,
  GraphEdge,
  GraphData,
  DocumentConnectionsResponse,
  EntityConnectionsResponse,
  TimelineEvent,
  TimelineResponse,
  Annotation,
  AnnotationListResponse,
} from "@/lib/api";

// View types
export type ViewType = "search" | "document" | "entities" | "faces" | "graph" | "timeline";

// Filter types
export interface SearchFilters {
  entityTypes?: string[];
  entityIds?: number[];
  dateFrom?: string;
  dateTo?: string;
  hasFaces?: boolean;
}

// UI State types
export interface SidebarState {
  collapsed: boolean;
  activeSection: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

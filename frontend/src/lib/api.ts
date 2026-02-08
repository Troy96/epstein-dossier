// Use empty string for client-side to leverage Next.js rewrites proxy
// The rewrites in next.config.js will proxy /api/* to the backend
const API_BASE = typeof window === "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080")
  : "";

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Search
export interface SearchHit {
  id: number;
  filename: string;
  title: string | null;
  page_count: number;
  score: number;
  highlights: Record<string, string[]>;
}

export interface SearchResponse {
  query: string;
  hits: SearchHit[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  processing_time_ms: number;
}

export async function search(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  return fetchAPI(`/api/search?${params}`);
}

// Documents
export interface Document {
  id: number;
  filename: string;
  title: string | null;
  source_url: string | null;
  page_count: number;
  file_size: number | null;
  has_images: boolean;
  image_count: number;
  download_status: string;
  ocr_status: string;
  entity_status: string;
  face_status: string;
  indexed_status: string;
  earliest_date: string | null;
  latest_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getDocuments(
  page: number = 1,
  pageSize: number = 20
): Promise<DocumentListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  return fetchAPI(`/api/documents?${params}`);
}

export async function getDocument(id: number): Promise<Document> {
  return fetchAPI(`/api/documents/${id}`);
}

export async function getDocumentText(id: number): Promise<{ id: number; filename: string; text: string | null; page_count: number }> {
  return fetchAPI(`/api/documents/${id}/text`);
}

export async function getDocumentImages(id: number): Promise<{ id: number; filename: string; images: string[] }> {
  return fetchAPI(`/api/documents/${id}/images`);
}

export function getDocumentPdfUrl(id: number): string {
  return `${API_BASE}/api/documents/${id}/pdf`;
}

// Entities
export interface Entity {
  id: number;
  name: string;
  normalized_name: string;
  entity_type: string;
  mention_count: number;
  document_count: number;
  created_at: string;
}

export interface EntityListResponse {
  entities: Entity[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getEntities(
  page: number = 1,
  pageSize: number = 20,
  entityType?: string,
  search?: string,
  sortBy?: "mention_count" | "name" | "document_count" | null,
  sortDir?: "asc" | "desc"
): Promise<EntityListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (entityType) params.append("entity_type", entityType);
  if (search) params.append("search", search);
  if (sortBy) params.append("sort_by", sortBy);
  if (sortDir) params.append("sort_dir", sortDir);
  return fetchAPI(`/api/entities?${params}`);
}

export async function getEntity(id: number): Promise<Entity> {
  return fetchAPI(`/api/entities/${id}`);
}

export interface EntityDocumentsResponse {
  entity: Entity;
  documents: { id: number; filename: string; title: string | null; mention_count: number }[];
  total: number;
}

export async function getEntityDocuments(id: number): Promise<EntityDocumentsResponse> {
  return fetchAPI(`/api/entities/${id}/documents`);
}

export async function getEntityTypes(): Promise<{ type: string; count: number }[]> {
  return fetchAPI("/api/entities/types");
}

// Faces
export interface Face {
  id: number;
  document_id: number;
  cluster_id: number | null;
  image_path: string;
  page_number: number | null;
  face_crop_path: string | null;
  face_size: number | null;
  confidence: number | null;
  created_at: string;
  document_filename: string | null;
}

export interface FaceListResponse {
  faces: Face[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getFaces(
  page: number = 1,
  pageSize: number = 20,
  documentId?: number,
  clusterId?: number
): Promise<FaceListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (documentId) params.append("document_id", documentId.toString());
  if (clusterId) params.append("cluster_id", clusterId.toString());
  return fetchAPI(`/api/faces?${params}`);
}

export interface FaceCluster {
  id: number;
  name: string | null;
  face_count: number;
  document_count: number;
  representative_face: Face | null;
  sample_faces: Face[];
}

export interface FaceClusterListResponse {
  clusters: FaceCluster[];
  total: number;
}

export async function getFaceClusters(minFaces: number = 2): Promise<FaceClusterListResponse> {
  const params = new URLSearchParams({ min_faces: minFaces.toString() });
  return fetchAPI(`/api/faces/clusters?${params}`);
}

export interface FaceSimilarityResult {
  face: Face;
  similarity: number;
  distance: number;
}

export interface FaceSimilarityResponse {
  query_face_id: number | null;
  results: FaceSimilarityResult[];
  total: number;
}

export async function findSimilarFaces(faceId: number, limit: number = 10): Promise<FaceSimilarityResponse> {
  const params = new URLSearchParams({ limit: limit.toString() });
  return fetchAPI(`/api/faces/${faceId}/similar?${params}`);
}

export async function dismissFace(faceId: number): Promise<void> {
  await fetchAPI(`/api/faces/${faceId}`, { method: "DELETE" });
}

// Graph
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  size: number;
  color: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  properties: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DocumentConnectionsResponse {
  document_id: number;
  document_filename: string;
  graph: GraphData;
  related_documents: { id: number; filename: string; title: string | null; connection_type: string; connection_strength: number }[];
}

export async function getDocumentConnections(documentId: number): Promise<DocumentConnectionsResponse> {
  return fetchAPI(`/api/graph/document/${documentId}/connections`);
}

export interface EntityConnectionsResponse {
  entity_id: number;
  entity_name: string;
  entity_type: string;
  graph: GraphData;
  co_occurring_entities: { id: number; name: string; entity_type: string; shared_documents: number }[];
}

export async function getEntityConnections(entityId: number): Promise<EntityConnectionsResponse> {
  return fetchAPI(`/api/graph/entity/${entityId}/connections`);
}

// Timeline
export interface TimelineEvent {
  date: string;
  document_id: number;
  document_filename: string;
  document_title: string | null;
  event_type: string;
  context: string | null;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  start_date: string | null;
  end_date: string | null;
  total: number;
}

export async function getTimeline(
  startDate?: string,
  endDate?: string,
  entityId?: number
): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  if (entityId) params.append("entity_id", entityId.toString());
  return fetchAPI(`/api/timeline?${params}`);
}

export async function getTimelineRange(): Promise<{ min_date: string | null; max_date: string | null; document_count: number }> {
  return fetchAPI("/api/timeline/range");
}

export async function getTimelineByYear(): Promise<{ year: number; count: number }[]> {
  return fetchAPI("/api/timeline/by-year");
}

export async function getTimelineByMonth(year: number): Promise<{ month: number; count: number }[]> {
  return fetchAPI(`/api/timeline/by-month?year=${year}`);
}

// Annotations
export interface Annotation {
  id: number;
  document_id: number;
  note: string | null;
  tags: string[] | null;
  bookmarked: boolean;
  page_number: number | null;
  highlight_start: number | null;
  highlight_end: number | null;
  highlight_text: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationListResponse {
  annotations: Annotation[];
  total: number;
}

export async function getAnnotations(documentId?: number): Promise<AnnotationListResponse> {
  const params = new URLSearchParams();
  if (documentId) params.append("document_id", documentId.toString());
  return fetchAPI(`/api/annotations?${params}`);
}

export async function createAnnotation(data: {
  document_id: number;
  note?: string;
  tags?: string[];
  bookmarked?: boolean;
  page_number?: number;
  highlight_text?: string;
}): Promise<Annotation> {
  return fetchAPI("/api/annotations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAnnotation(
  id: number,
  data: Partial<Annotation>
): Promise<Annotation> {
  return fetchAPI(`/api/annotations/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteAnnotation(id: number): Promise<void> {
  await fetchAPI(`/api/annotations/${id}`, { method: "DELETE" });
}

export async function getBookmarks(): Promise<AnnotationListResponse> {
  return fetchAPI("/api/annotations/bookmarks/all");
}

// Image Analysis
export interface ImageAnalysisItem {
  id: number;
  document_id: number;
  image_path: string;
  description: string | null;
  tags: string[] | null;
  category: string | null;
  interest_score: number;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
  document_filename: string | null;
}

export interface ImageAnalysisListResponse {
  analyses: ImageAnalysisItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ImageAnalysisStats {
  total_analyzed: number;
  total_flagged: number;
  by_category: Record<string, number>;
  avg_interest_score: number;
}

export async function getImageAnalyses(
  page: number = 1,
  pageSize: number = 20,
  category?: string,
  flagged?: boolean,
  minScore?: number,
  sortBy?: string,
  sortDir?: string
): Promise<ImageAnalysisListResponse> {
  const params = new URLSearchParams({
    page: page.toString(),
    page_size: pageSize.toString(),
  });
  if (category) params.append("category", category);
  if (flagged !== undefined) params.append("flagged", flagged.toString());
  if (minScore !== undefined) params.append("min_score", minScore.toString());
  if (sortBy) params.append("sort_by", sortBy);
  if (sortDir) params.append("sort_dir", sortDir);
  return fetchAPI(`/api/image-analysis?${params}`);
}

export async function getImageAnalysis(id: number): Promise<ImageAnalysisItem> {
  return fetchAPI(`/api/image-analysis/${id}`);
}

export async function getImageAnalysisStats(): Promise<ImageAnalysisStats> {
  return fetchAPI("/api/image-analysis/stats");
}

export async function updateImageAnalysis(
  id: number,
  data: Partial<Pick<ImageAnalysisItem, "tags" | "category" | "interest_score" | "flagged" | "flag_reason">>
): Promise<ImageAnalysisItem> {
  return fetchAPI(`/api/image-analysis/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Stats
export async function getDocumentStats(): Promise<{
  total: number;
  by_status: Record<string, number>;
  with_images: number;
}> {
  return fetchAPI("/api/documents/stats/summary");
}

// Export helpers
export function getExportUrl(type: string, format: string, query?: string): string {
  const params = new URLSearchParams({ format });
  if (query) params.append("q", query);
  return `${API_BASE}/api/export/${type}?${params}`;
}

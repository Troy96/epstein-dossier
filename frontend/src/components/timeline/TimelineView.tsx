"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Search,
  BarChart3,
  List,
  X,
  User,
  Building,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getTimeline,
  getTimelineRange,
  getTimelineByYear,
  getEntities,
  TimelineEvent,
  Entity,
} from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

interface TimelineViewProps {
  onDocumentSelect: (documentId: number) => void;
}

type ViewMode = "list" | "chart";

export function TimelineView({ onDocumentSelect }: TimelineViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [yearCounts, setYearCounts] = useState<{ year: number; count: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [yearRangeStart, setYearRangeStart] = useState<number | null>(null);
  const [yearRangeEnd, setYearRangeEnd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [range, setRange] = useState<{ min: string | null; max: string | null }>({
    min: null,
    max: null,
  });

  // Enhanced features
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<Entity | null>(null);
  const [showEntitySearch, setShowEntitySearch] = useState(false);
  const [entitySearchQuery, setEntitySearchQuery] = useState("");
  const [entitySearchResults, setEntitySearchResults] = useState<Entity[]>([]);
  const [entitySearchLoading, setEntitySearchLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadYearEvents(selectedYear);
    } else if (yearRangeStart && yearRangeEnd) {
      loadRangeEvents(yearRangeStart, yearRangeEnd);
    }
  }, [selectedYear, yearRangeStart, yearRangeEnd, entityFilter]);

  // Entity search
  useEffect(() => {
    if (entitySearchQuery.length >= 2) {
      const timer = setTimeout(() => searchEntities(entitySearchQuery), 300);
      return () => clearTimeout(timer);
    } else {
      setEntitySearchResults([]);
    }
  }, [entitySearchQuery]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rangeData, yearData] = await Promise.all([
        getTimelineRange(),
        getTimelineByYear(),
      ]);
      setRange({ min: rangeData.min_date, max: rangeData.max_date });
      setYearCounts(yearData);

      // Set initial range to all years, select the one with most events
      if (yearData.length > 0) {
        const years = yearData.map((y) => y.year);
        setYearRangeStart(Math.min(...years));
        setYearRangeEnd(Math.max(...years));
        const maxYear = yearData.reduce((max, curr) =>
          curr.count > max.count ? curr : max
        );
        setSelectedYear(maxYear.year);
      }
    } catch (error) {
      console.error("Failed to load timeline data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadYearEvents = async (year: number) => {
    setEventsLoading(true);
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const data = await getTimeline(startDate, endDate, entityFilter?.id);
      setEvents(data.events);
    } catch (error) {
      console.error("Failed to load year events:", error);
    } finally {
      setEventsLoading(false);
    }
  };

  const loadRangeEvents = async (startYear: number, endYear: number) => {
    setEventsLoading(true);
    try {
      const startDate = `${startYear}-01-01`;
      const endDate = `${endYear}-12-31`;
      const data = await getTimeline(startDate, endDate, entityFilter?.id);
      setEvents(data.events);
    } catch (error) {
      console.error("Failed to load range events:", error);
    } finally {
      setEventsLoading(false);
    }
  };

  const searchEntities = async (query: string) => {
    setEntitySearchLoading(true);
    try {
      const data = await getEntities(1, 10, undefined, query);
      setEntitySearchResults(data.entities);
    } catch (error) {
      console.error("Failed to search entities:", error);
    } finally {
      setEntitySearchLoading(false);
    }
  };

  // Filter events by search query
  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const query = searchQuery.toLowerCase();
    return events.filter(
      (e) =>
        e.document_filename.toLowerCase().includes(query) ||
        e.document_title?.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  // Group events by month
  const eventsByMonth = useMemo(() => {
    return filteredEvents.reduce<Record<string, TimelineEvent[]>>(
      (acc, event) => {
        const date = new Date(event.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (!acc[monthKey]) {
          acc[monthKey] = [];
        }
        acc[monthKey].push(event);
        return acc;
      },
      {}
    );
  }, [filteredEvents]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Filter years by range
  const filteredYearCounts = useMemo(() => {
    if (!yearRangeStart || !yearRangeEnd) return yearCounts;
    return yearCounts.filter(
      (y) => y.year >= yearRangeStart && y.year <= yearRangeEnd
    );
  }, [yearCounts, yearRangeStart, yearRangeEnd]);

  const allYears = useMemo(() => yearCounts.map((y) => y.year), [yearCounts]);
  const minYear = allYears.length > 0 ? Math.min(...allYears) : 1900;
  const maxYear = allYears.length > 0 ? Math.max(...allYears) : 2025;

  // Calculate max count for chart scaling
  const maxYearCount = Math.max(...filteredYearCounts.map((y) => y.count), 1);

  const getEntityIcon = (type: string) => {
    switch (type) {
      case "PERSON":
        return User;
      case "ORG":
        return Building;
      case "GPE":
      case "LOC":
        return MapPin;
      default:
        return User;
    }
  };

  if (loading) {
    return <LoadingState message="Loading timeline..." />;
  }

  if (yearCounts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Timeline View</h2>
        <p className="text-muted-foreground text-center max-w-md">
          No documents with extracted dates found. The timeline shows documents
          organized by date when dates are detected in the document content.
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Date extraction happens during OCR processing and entity extraction.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Timeline</h1>
          {range.min && range.max && (
            <span className="text-sm text-muted-foreground">
              {range.min} to {range.max}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year Range Filter */}
          <div className="flex items-center gap-1.5 bg-muted border border-border rounded-md px-2 py-1">
            <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <select
              value={yearRangeStart ?? minYear}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setYearRangeStart(val);
                if (yearRangeEnd && val > yearRangeEnd) setYearRangeEnd(val);
                if (selectedYear && selectedYear < val) setSelectedYear(val);
              }}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            >
              {allYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-muted-foreground text-sm">–</span>
            <select
              value={yearRangeEnd ?? maxYear}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setYearRangeEnd(val);
                if (yearRangeStart && val < yearRangeStart) setYearRangeStart(val);
                if (selectedYear && selectedYear > val) setSelectedYear(val);
              }}
              className="bg-transparent text-sm font-medium focus:outline-none cursor-pointer"
            >
              {allYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            {(yearRangeStart !== minYear || yearRangeEnd !== maxYear) && (
              <button
                onClick={() => {
                  setYearRangeStart(minYear);
                  setYearRangeEnd(maxYear);
                }}
                className="ml-1"
                title="Reset range"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Entity Filter */}
          <div className="relative">
            {entityFilter ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEntityFilter(null)}
                className="gap-2"
              >
                {(() => {
                  const Icon = getEntityIcon(entityFilter.entity_type);
                  return <Icon className="h-4 w-4" />;
                })()}
                {entityFilter.name}
                <X className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEntitySearch(!showEntitySearch)}
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filter by Entity
              </Button>
            )}

            {showEntitySearch && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-popover border border-border rounded-lg shadow-lg z-50">
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search entities..."
                      value={entitySearchQuery}
                      onChange={(e) => setEntitySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {entitySearchLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Searching...
                    </div>
                  ) : entitySearchResults.length > 0 ? (
                    entitySearchResults.map((entity) => {
                      const Icon = getEntityIcon(entity.entity_type);
                      return (
                        <button
                          key={entity.id}
                          onClick={() => {
                            setEntityFilter(entity);
                            setShowEntitySearch(false);
                            setEntitySearchQuery("");
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{entity.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {entity.document_count}
                          </Badge>
                        </button>
                      );
                    })
                  ) : entitySearchQuery.length >= 2 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No entities found
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Type at least 2 characters
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-border rounded-md">
            <Button
              variant={viewMode === "chart" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("chart")}
              className="rounded-r-none"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Year Selector / Chart */}
        <div className="w-64 flex-shrink-0">
          <Card className="h-full overflow-hidden flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Years
                <Badge variant="secondary" className="ml-auto">
                  {filteredYearCounts.reduce((sum, y) => sum + y.count, 0)} docs
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-auto">
              {viewMode === "chart" ? (
                <div className="space-y-1">
                  {filteredYearCounts.map(({ year, count }) => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 rounded-md transition-colors",
                        selectedYear === year
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="w-12 text-sm font-medium">{year}</span>
                      <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            selectedYear === year
                              ? "bg-primary-foreground/50"
                              : "bg-primary"
                          )}
                          style={{ width: `${(count / maxYearCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-8 text-xs text-right">{count}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredYearCounts.map(({ year, count }) => (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={cn(
                        "w-full px-3 py-2.5 text-left hover:bg-muted transition-colors flex items-center justify-between",
                        selectedYear === year && "bg-muted"
                      )}
                    >
                      <span className="font-medium">{year}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedYear ? (
            <>
              {/* Year Header */}
              <div className="flex items-center justify-between mb-4 gap-4">
                <div className="flex items-center gap-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const idx = filteredYearCounts.findIndex((y) => y.year === selectedYear);
                      if (idx > 0) setSelectedYear(filteredYearCounts[idx - 1].year);
                    }}
                    disabled={filteredYearCounts.findIndex((y) => y.year === selectedYear) === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-2xl font-bold">{selectedYear}</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const idx = filteredYearCounts.findIndex((y) => y.year === selectedYear);
                      if (idx < filteredYearCounts.length - 1) setSelectedYear(filteredYearCounts[idx + 1].year);
                    }}
                    disabled={filteredYearCounts.findIndex((y) => y.year === selectedYear) === filteredYearCounts.length - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search within year */}
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary w-48"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                      >
                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    )}
                  </div>

                  <p className="text-muted-foreground text-sm">
                    {filteredEvents.length} {filteredEvents.length === 1 ? "document" : "documents"}
                    {searchQuery && ` (filtered from ${events.length})`}
                  </p>
                </div>
              </div>

              {/* Events List */}
              <div className="flex-1 overflow-auto">
                {eventsLoading ? (
                  <LoadingState message={`Loading ${selectedYear}...`} />
                ) : Object.keys(eventsByMonth).length > 0 ? (
                  <div className="relative pb-8">
                    {/* Timeline line */}
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                    {/* Events by month */}
                    {Object.entries(eventsByMonth)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([monthKey, monthEvents]) => {
                        const [, month] = monthKey.split("-");
                        const monthIndex = parseInt(month) - 1;
                        return (
                          <div key={monthKey} className="relative pl-12 pb-6">
                            {/* Month marker */}
                            <div className="absolute left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-background" />
                            </div>

                            {/* Month header */}
                            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                              {monthNames[monthIndex]}
                              <Badge variant="outline">{monthEvents.length}</Badge>
                            </h3>

                            {/* Events */}
                            <div className="space-y-2">
                              {monthEvents.map((event, index) => (
                                <Card
                                  key={`${event.document_id}-${index}`}
                                  className="cursor-pointer hover:border-primary hover:shadow-md transition-all"
                                  onClick={() => onDocumentSelect(event.document_id)}
                                >
                                  <CardContent className="p-3">
                                    <div className="flex items-start gap-3">
                                      <div className="p-2 bg-secondary rounded">
                                        <FileText className="h-4 w-4 text-primary" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium truncate">
                                          {event.document_title || event.document_filename}
                                        </p>
                                        {event.document_title && (
                                          <p className="text-sm text-muted-foreground truncate">
                                            {event.document_filename}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-2 mt-1">
                                          <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                          <p className="text-xs text-muted-foreground">
                                            {formatDate(event.date)}
                                          </p>
                                          {event.context && (
                                            <Badge variant="outline" className="text-xs">
                                              {event.event_type}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <EmptyState
                    title="No dated documents"
                    description={
                      searchQuery
                        ? `No documents matching "${searchQuery}" found for ${selectedYear}`
                        : entityFilter
                          ? `No documents mentioning ${entityFilter.name} found for ${selectedYear}`
                          : `No documents with extracted dates found for ${selectedYear}`
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a year"
              description="Choose a year from the list to view documents"
            />
          )}
        </div>
      </div>

      {/* Click outside to close entity search */}
      {showEntitySearch && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowEntitySearch(false)}
        />
      )}
    </div>
  );
}

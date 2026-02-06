"use client";

import { useState, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, EmptyState } from "@/components/ui/Spinner";
import {
  getTimeline,
  getTimelineRange,
  getTimelineByYear,
  TimelineEvent,
} from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

interface TimelineViewProps {
  onDocumentSelect: (documentId: number) => void;
}

export function TimelineView({ onDocumentSelect }: TimelineViewProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [yearCounts, setYearCounts] = useState<{ year: number; count: number }[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<{ min: string | null; max: string | null }>({
    min: null,
    max: null,
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedYear) {
      loadYearEvents(selectedYear);
    }
  }, [selectedYear]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [rangeData, yearData] = await Promise.all([
        getTimelineRange(),
        getTimelineByYear(),
      ]);
      setRange({ min: rangeData.min_date, max: rangeData.max_date });
      setYearCounts(yearData);

      // Select first year with events
      if (yearData.length > 0) {
        setSelectedYear(yearData[0].year);
      }
    } catch (error) {
      console.error("Failed to load timeline data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadYearEvents = async (year: number) => {
    try {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const data = await getTimeline(startDate, endDate);
      setEvents(data.events);
    } catch (error) {
      console.error("Failed to load year events:", error);
    }
  };

  // Group events by month
  const eventsByMonth = events.reduce<Record<string, TimelineEvent[]>>(
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

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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
    <div className="flex gap-4 h-full">
      {/* Year Selector */}
      <div className="w-48 flex-shrink-0">
        <Card className="h-full overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Years
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-auto">
            <div className="divide-y divide-border">
              {yearCounts.map(({ year, count }) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between",
                    selectedYear === year && "bg-muted"
                  )}
                >
                  <span className="font-medium">{year}</span>
                  <Badge variant="secondary">{count}</Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-auto">
        {selectedYear ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{selectedYear}</h2>
              <p className="text-muted-foreground">
                {events.length} documents
              </p>
            </div>

            {Object.keys(eventsByMonth).length > 0 ? (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {/* Events by month */}
                {Object.entries(eventsByMonth)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([monthKey, monthEvents]) => {
                    const [, month] = monthKey.split("-");
                    const monthIndex = parseInt(month) - 1;
                    return (
                      <div key={monthKey} className="relative pl-12 pb-8">
                        {/* Month marker */}
                        <div className="absolute left-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-background" />
                        </div>

                        {/* Month header */}
                        <h3 className="text-lg font-semibold mb-4">
                          {monthNames[monthIndex]}
                        </h3>

                        {/* Events */}
                        <div className="space-y-2">
                          {monthEvents.map((event, index) => (
                            <Card
                              key={`${event.document_id}-${index}`}
                              className="cursor-pointer hover:border-primary/50 transition-colors"
                              onClick={() => onDocumentSelect(event.document_id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-start gap-3">
                                  <div className="p-1.5 bg-muted rounded">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">
                                      {event.document_filename}
                                    </p>
                                    {event.document_title && (
                                      <p className="text-sm text-muted-foreground truncate">
                                        {event.document_title}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {formatDate(event.date)}
                                    </p>
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
                description={`No documents with extracted dates found for ${selectedYear}`}
              />
            )}
          </div>
        ) : (
          <EmptyState
            title="Select a year"
            description="Choose a year from the list to view documents"
          />
        )}
      </div>
    </div>
  );
}

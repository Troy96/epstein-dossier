import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function getEntityColor(type: string): string {
  const colors: Record<string, string> = {
    PERSON: "#ef4444",
    ORG: "#22c55e",
    GPE: "#f59e0b",
    LOC: "#8b5cf6",
    DATE: "#06b6d4",
  };
  return colors[type.toUpperCase()] || "#6b7280";
}

export function getEntityLabel(type: string): string {
  const labels: Record<string, string> = {
    PERSON: "Person",
    ORG: "Organization",
    GPE: "Location (GPE)",
    LOC: "Location",
    DATE: "Date",
  };
  return labels[type.toUpperCase()] || type;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function highlightText(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

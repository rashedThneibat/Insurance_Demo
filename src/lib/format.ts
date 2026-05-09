import type { ClaimStatus, ClaimType, Priority } from "./types";

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} · ${time}`;
}

export function relativeTime(iso: string): string {
  const now = Date.now();
  const diff = now - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

export function priorityColor(p: Priority): string {
  switch (p) {
    case "critical":
      return "bg-red-100 text-red-700 border-red-200";
    case "high":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "low":
      return "bg-green-100 text-green-700 border-green-200";
  }
}

export function statusLabel(s: ClaimStatus): string {
  switch (s) {
    case "open":
      return "Open";
    case "in_review":
      return "In Review";
    case "awaiting_info":
      return "Pending Approval";
    case "closed":
      return "Closed";
  }
}

export function claimTypeLabel(t: ClaimType): string {
  switch (t) {
    case "total_loss":
      return "Total Loss";
    case "repair":
      return "Repair";
    case "reimbursement":
      return "Reimbursement";
  }
}

export function claimTypeColor(t: ClaimType): string {
  switch (t) {
    case "total_loss":
      return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900";
    case "repair":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900";
    case "reimbursement":
      return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900";
  }
}

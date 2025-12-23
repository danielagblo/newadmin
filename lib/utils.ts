import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(
  amount: string | number,
  currency: string = "GHS"
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: currency,
  }).format(numAmount);
}

export function formatDate(
  date: string | Date,
  format: string = "MMM dd, yyyy"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(dateObj);
}

export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

export function truncate(text: string, length: number = 50): string {
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
}

export function getImageUrl(imagePath: string | null | undefined): string {
  if (!imagePath) return "";
  if (imagePath.startsWith("http")) return imagePath;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return `${apiUrl}${imagePath}`;
}
// LocalStorage CRUD helpers (safe for SSR and JSON values)
export const lsAvailable = (): boolean => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

export function lsSet(key: string, value: any): void {
  try {
    if (!lsAvailable()) return;
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, raw);
  } catch {
    // ignore
  }
}

export function lsGet<T = any>(
  key: string,
  defaultValue: T | null = null
): T | null {
  try {
    if (!lsAvailable()) return defaultValue;
    const raw = localStorage.getItem(key);
    if (raw == null) return defaultValue;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // not JSON, return as string
      return raw as unknown as T;
    }
  } catch {
    return defaultValue;
  }
}

export function lsRemove(key: string): void {
  try {
    if (!lsAvailable()) return;
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function lsClear(): void {
  try {
    if (!lsAvailable()) return;
    localStorage.clear();
  } catch {
    // ignore
  }
}

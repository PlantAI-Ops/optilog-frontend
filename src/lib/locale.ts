"use client";

import { useState, useEffect } from "react";

export function useLocale() {
  const [locale, setLocale] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    setLocale(typeof navigator !== "undefined" ? navigator.language : undefined);
  }, []);
  
  return locale;
}

export function useClient() {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient;
}

export function formatNumber(value: number | string): string {
  if (typeof window === "undefined") {
    return String(value);
  }
  try {
    return Number(value).toLocaleString(navigator.language);
  } catch {
    return String(value);
  }
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  if (typeof window === "undefined") {
    return String(date);
  }
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleDateString(navigator.language, { year: "numeric", month: "short", day: "numeric", ...options });
  } catch {
    return String(date);
  }
}

export function formatTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  if (typeof window === "undefined") {
    return String(date);
  }
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return dateObj.toLocaleTimeString(navigator.language, { hour: "2-digit", minute: "2-digit", hour12: false, ...options });
  } catch {
    return String(date);
  }
}

export function useFormattedNumber(value: number | string): string {
  const [isClient, setIsClient] = useState(false);
  const [formatted, setFormatted] = useState("");
  
  useEffect(() => {
    setFormatted(formatNumber(value));
    setIsClient(true);
  }, [value]);
  
  return isClient ? formatted : String(value);
}

export function useFormattedDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const [isClient, setIsClient] = useState(false);
  const [formatted, setFormatted] = useState("");
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        setFormatted(dateObj.toLocaleDateString(navigator.language, { year: "numeric", month: "short", day: "numeric", ...options }));
      } catch {
        setFormatted(String(date));
      }
      setIsClient(true);
    }
  }, [date]);
  
  return isClient ? formatted : String(date);
}

export function useFormattedTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const [isClient, setIsClient] = useState(false);
  const [formatted, setFormatted] = useState("");
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const dateObj = typeof date === "string" ? new Date(date) : date;
        setFormatted(dateObj.toLocaleTimeString(navigator.language, { hour: "2-digit", minute: "2-digit", hour12: false, ...options }));
      } catch {
        setFormatted(String(date));
      }
      setIsClient(true);
    }
  }, [date]);
  
  return isClient ? formatted : String(date);
}
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// lib/rag.ts
export async function getRelevantDocs(query: string): Promise<string[]> {
  // Simulate relevant document retrieval
  return [
    "The return policy allows customers to return products within 30 days of purchase.",
    "Returned items must be in original condition and packaging.",
  ];
}


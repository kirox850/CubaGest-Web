import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Helper estándar de shadcn/ui: combina clases condicionales y resuelve
// conflictos de Tailwind (la última gana).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

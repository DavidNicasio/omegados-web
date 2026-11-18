import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const horaCorta = (d: Date) =>
  d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });

/** "hoy 09:12", "ayer 18:40" o "12 nov 09:12" */
export function formatearFechaCorta(ts: number): string {
  const d = new Date(ts);
  const ahora = new Date();
  const ayer = new Date();
  ayer.setDate(ahora.getDate() - 1);
  if (mismoDia(d, ahora)) return `hoy ${horaCorta(d)}`;
  if (mismoDia(d, ayer)) return `ayer ${horaCorta(d)}`;
  const dia = d.toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(".", "");
  return `${dia} ${horaCorta(d)}`;
}

/** "12 de noviembre de 2026 a las 09:12" */
export function formatearFechaLarga(ts: number): string {
  const d = new Date(ts);
  const dia = d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  return `${dia} a las ${horaCorta(d)}`;
}

/** "SANTA ROSA" -> "Santa Rosa" (VA se queda como está) */
export function nombreSucursal(s: string): string {
  if (s === "VA") return s;
  return s
    .toLowerCase()
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** Solo para mostrar: quita etiquetas tipo *MARCA* y espacios repetidos. Para exportar se usa el nombre original. */
export function limpiarNombreProducto(nombre: string): string {
  const base = String(nombre ?? "");
  const limpio = base.replace(/\*[^*]*\*/g, " ").replace(/\s+/g, " ").trim();
  return limpio || base.replace(/\s+/g, " ").trim();
}

/** Identifica un archivo por nombre, tamaño y fecha de modificación */
export function huellaArchivo(f: File): string {
  return `${f.name}|${f.size}|${f.lastModified}`;
}

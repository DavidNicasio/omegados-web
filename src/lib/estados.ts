// Estados de rotación y su paleta (una sola fuente para Inventario y Resumen)

export type EstadoRotacion = "ROTACIÓN ACTIVA" | "NULA ROTACIÓN" | "COMPRA URGENTE" | "SIN MOVIMIENTO";

export interface InfoEstado {
    etiqueta: string;
    color: string; // color sólido (gráficas)
    chipBg: string;
    chipFg: string;
    ayuda: string;
}

export const ESTADOS: Record<EstadoRotacion, InfoEstado> = {
    "ROTACIÓN ACTIVA": {
        etiqueta: "Rotación activa",
        color: "#16A34A",
        chipBg: "#DCFCE7",
        chipFg: "#166534",
        ayuda: "Hay existencia y se vende.",
    },
    "NULA ROTACIÓN": {
        etiqueta: "Nula rotación",
        color: "#F59E0B",
        chipBg: "#FEF3C7",
        chipFg: "#92400E",
        ayuda: "Hay existencia pero no se vende. Es candidata a traspaso.",
    },
    "COMPRA URGENTE": {
        etiqueta: "Compra urgente",
        color: "#DC2626",
        chipBg: "#FEE2E2",
        chipFg: "#991B1B",
        ayuda: "Se vende y ya no hay.",
    },
    "SIN MOVIMIENTO": {
        etiqueta: "Sin movimiento",
        color: "#94A3B8",
        chipBg: "#E2E8F0",
        chipFg: "#334155",
        ayuda: "No hay existencia y tampoco se vende.",
    },
};

export const ORDEN_ESTADOS: EstadoRotacion[] = ["ROTACIÓN ACTIVA", "NULA ROTACIÓN", "COMPRA URGENTE", "SIN MOVIMIENTO"];

export const esEstadoRotacion = (v: unknown): v is EstadoRotacion => typeof v === "string" && v in ESTADOS;

import type { Alert } from "./excel";

export interface GrupoTraspaso {
    id: string; // ruta estable: "ORIGEN|DESTINO"
    origen: string;
    destino: string;
    items: Alert[];
    piezas: number;
}

export type TipoAlertaHecha = "traspasos" | "compras";

/** Qué traspasos (por ruta) y compras (por clave) ya se marcaron como hechos o pedidos */
export interface AlertasHechas {
    traspasos: Record<string, true>;
    compras: Record<string, true>;
}

export const alertasHechasVacias = (): AlertasHechas => ({ traspasos: {}, compras: {} });

export const idTraspaso = (origen: string, destino: string) => `${origen}|${destino}`;

const cantidadNumerica = (a: Alert) => (typeof a.cantidad === "number" ? a.cantidad : 0);

export const sumarPiezas = (items: Alert[]) => items.reduce((t, a) => t + cantidadNumerica(a), 0);

/** Agrupa los traspasos por ruta origen -> destino, de mayor a menor cantidad de piezas */
export const agruparTraspasos = (alerts: Alert[]): GrupoTraspaso[] => {
    const mapa = new Map<string, GrupoTraspaso>();
    alerts.forEach((a) => {
        if (a.tipo !== "TRASPASO") return;
        const id = idTraspaso(a.origen, a.destino);
        let g = mapa.get(id);
        if (!g) {
            g = { id, origen: a.origen, destino: a.destino, items: [], piezas: 0 };
            mapa.set(id, g);
        }
        g.items.push(a);
        g.piezas += cantidadNumerica(a);
    });
    return Array.from(mapa.values()).sort((a, b) => b.piezas - a.piezas || a.id.localeCompare(b.id));
};

/** Cuántos traspasos (rutas) y compras siguen pendientes */
export const contarPendientes = (alerts: Alert[], hechas: AlertasHechas) => {
    const rutas = new Set<string>();
    let compras = 0;
    alerts.forEach((a) => {
        if (a.tipo === "TRASPASO") rutas.add(idTraspaso(a.origen, a.destino));
        else if (!hechas.compras[a.clave]) compras++;
    });
    let traspasos = 0;
    rutas.forEach((id) => {
        if (!hechas.traspasos[id]) traspasos++;
    });
    return { traspasos, compras, total: traspasos + compras };
};

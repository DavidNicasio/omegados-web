import React, { createContext, useContext, useState, useEffect } from "react";
import { MasterRow, Alert } from "./lib/excel";
import { AlertasHechas, TipoAlertaHecha, alertasHechasVacias } from "./lib/alertas";

export interface LoadInfo {
    existenciasName: string;
    ventasName: string;
    loadedAt: number; // marca de tiempo (ms)
}

// Huella de un archivo de ventas ya sumado (para no sumarlo dos veces sin querer)
export interface HuellaVentas {
    huella: string; // nombre|tamaño|última modificación
    nombre: string;
    fecha: number; // cuándo se cargó (ms)
}

interface AppState {
    activeView: string;
    setActiveView: (view: string) => void;
    masterData: MasterRow[] | null;
    setMasterData: (data: MasterRow[] | null) => void;
    alerts: Alert[];
    setAlerts: (alerts: Alert[]) => void;
    cols: string[];
    setCols: (cols: string[]) => void;
    loadInfo: LoadInfo | null;
    setLoadInfo: (info: LoadInfo | null) => void;
    huellasVentas: HuellaVentas[];
    setHuellasVentas: (h: HuellaVentas[]) => void;
    alertasHechas: AlertasHechas;
    setAlertasHechas: (h: AlertasHechas) => void;
    marcarAlerta: (tipo: TipoAlertaHecha, id: string, hecha: boolean) => void;
    isDBLoaded: boolean;
}

// --- UTILIDAD DE BASE DE DATOS NATIVA (INDEXEDDB) ---
const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("FarmaciaERP_DB", 1);
        request.onupgradeneeded = (e: any) => {
            e.target.result.createObjectStore("app_state");
        };
        request.onsuccess = (e: any) => resolve(e.target.result);
        request.onerror = (e) => reject(e);
    });
};

const saveToDB = async (key: string, data: any) => {
    const db = await initDB();
    db.transaction("app_state", "readwrite").objectStore("app_state").put(data, key);
};

const loadFromDB = async (key: string): Promise<any> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const req = db.transaction("app_state", "readonly").objectStore("app_state").get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
};
// ----------------------------------------------------

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [activeView, setActiveView] = useState("inicio");
    const [masterData, setMasterData] = useState<MasterRow[] | null>(null);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [cols, setCols] = useState<string[]>([]);
    const [loadInfo, setLoadInfo] = useState<LoadInfo | null>(null);
    const [huellasVentas, setHuellasVentas] = useState<HuellaVentas[]>([]);
    const [alertasHechas, setAlertasHechas] = useState<AlertasHechas>(alertasHechasVacias());
    const [isDBLoaded, setIsDBLoaded] = useState(false);

    // Cargar datos desde la base de datos al iniciar la app
    useEffect(() => {
        const loadState = async () => {
            try {
                const savedMaster = await loadFromDB("masterData");
                const savedAlerts = await loadFromDB("alerts");
                const savedCols = await loadFromDB("cols");
                const savedLoadInfo = await loadFromDB("loadInfo");
                const savedHuellas = await loadFromDB("huellasVentas");
                const savedHechas = await loadFromDB("alertasHechas");

                if (savedMaster) setMasterData(savedMaster);
                if (savedAlerts) setAlerts(savedAlerts);
                if (savedCols) setCols(savedCols);
                if (savedLoadInfo) setLoadInfo(savedLoadInfo);
                if (savedHuellas) setHuellasVentas(savedHuellas);
                if (savedHechas) setAlertasHechas(savedHechas);
            } catch (error) {
                console.error("Error cargando la DB:", error);
            } finally {
                setIsDBLoaded(true); // Indica que ya terminó de leer la memoria
            }
        };
        loadState();
    }, []);

    // Guardar datos automáticamente cuando cambien
    useEffect(() => {
        if (isDBLoaded) {
            saveToDB("masterData", masterData);
            saveToDB("alerts", alerts);
            saveToDB("cols", cols);
            saveToDB("loadInfo", loadInfo);
            saveToDB("huellasVentas", huellasVentas);
            saveToDB("alertasHechas", alertasHechas);
        }
    }, [masterData, alerts, cols, loadInfo, huellasVentas, alertasHechas, isDBLoaded]);

    // Si una actualización hace desaparecer una ruta o una compra, olvidamos su estado de hecho/pedido
    useEffect(() => {
        if (!isDBLoaded) return;
        const traspasos = new Set<string>();
        const compras = new Set<string>();
        alerts.forEach((a) => {
            if (a.tipo === "TRASPASO") traspasos.add(`${a.origen}|${a.destino}`);
            else compras.add(a.clave);
        });
        setAlertasHechas((prev) => {
            const t = Object.keys(prev.traspasos).filter((id) => traspasos.has(id));
            const c = Object.keys(prev.compras).filter((id) => compras.has(id));
            if (t.length === Object.keys(prev.traspasos).length && c.length === Object.keys(prev.compras).length) return prev;
            return {
                traspasos: Object.fromEntries(t.map((id) => [id, true as const])),
                compras: Object.fromEntries(c.map((id) => [id, true as const])),
            };
        });
    }, [alerts, isDBLoaded]);

    const marcarAlerta = (tipo: TipoAlertaHecha, id: string, hecha: boolean) => {
        setAlertasHechas((prev) => {
            const grupo = { ...prev[tipo] };
            if (hecha) grupo[id] = true;
            else delete grupo[id];
            return { ...prev, [tipo]: grupo };
        });
    };

    return (
        <AppContext.Provider
            value={{
                activeView,
                setActiveView,
                masterData,
                setMasterData,
                alerts,
                setAlerts,
                cols,
                setCols,
                loadInfo,
                setLoadInfo,
                huellasVentas,
                setHuellasVentas,
                alertasHechas,
                setAlertasHechas,
                marcarAlerta,
                isDBLoaded,
            }}
        >
            {/* Mostramos un loader rápido mientras lee la base de datos (evita pantallazos) */}
            {!isDBLoaded ? (
                <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white font-mono text-sm">
                    Cargando inventario guardado...
                </div>
            ) : (
                children
            )}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within an AppProvider");
    return context;
};
import React, { createContext, useContext, useState, useEffect } from "react";
import { MasterRow, Alert } from "./lib/excel";

interface AppState {
    activeView: string;
    setActiveView: (view: string) => void;
    masterData: MasterRow[] | null;
    setMasterData: (data: MasterRow[] | null) => void;
    alerts: Alert[];
    setAlerts: (alerts: Alert[]) => void;
    cols: string[];
    setCols: (cols: string[]) => void;
    fileName: string | null;
    setFileName: (name: string | null) => void;
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
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDBLoaded, setIsDBLoaded] = useState(false);

    // Cargar datos desde la base de datos al iniciar la app
    useEffect(() => {
        const loadState = async () => {
            try {
                const savedMaster = await loadFromDB("masterData");
                const savedAlerts = await loadFromDB("alerts");
                const savedCols = await loadFromDB("cols");
                const savedFileName = await loadFromDB("fileName");

                if (savedMaster) setMasterData(savedMaster);
                if (savedAlerts) setAlerts(savedAlerts);
                if (savedCols) setCols(savedCols);
                if (savedFileName) setFileName(savedFileName);
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
            saveToDB("fileName", fileName);
        }
    }, [masterData, alerts, cols, fileName, isDBLoaded]);

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
                fileName,
                setFileName,
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
import React, { useState } from "react";
import { Home, Upload, Bell, Package, RefreshCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { useAppContext } from "../AppContext";

interface NavItem {
    id: string;
    label: string;
    icon: LucideIcon;
}

// Orden pensado como el flujo real de uso: cargar -> revisar alertas -> consultar inventario
const NAV_ITEMS: NavItem[] = [
    { id: "inicio", label: "Resumen", icon: Home },
    { id: "paso2", label: "1. Cargar datos", icon: Upload },
    { id: "alertas", label: "2. Alertas", icon: Bell },
    { id: "inventario", label: "3. Inventario", icon: Package },
];

// Se usa después de la primera carga, por eso va aparte
const UPDATE_ITEM: NavItem = { id: "sync", label: "Actualizar datos", icon: RefreshCcw };

export const Sidebar: React.FC = () => {
    const {
        activeView,
        setActiveView,
        masterData,
        setMasterData,
        alerts,
        setAlerts,
        setCols,
        fileName,
        setFileName,
    } = useAppContext();

    const [confirmClear, setConfirmClear] = useState(false);

    const hasData = !!masterData && masterData.length > 0;

    const handleClear = () => {
        setMasterData(null);
        setAlerts([]);
        setCols([]);
        setFileName(null);
        setConfirmClear(false);
        setActiveView("inicio");
    };

    const renderItem = (item: NavItem) => {
        const isActive = activeView === item.id;
        const showBadge = item.id === "alertas" && hasData && alerts.length > 0;

        return (
            <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                    "w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                        ? "bg-slate-800 text-white shadow-[inset_3px_0_0_#60a5fa]"
                        : "text-slate-300 hover:bg-slate-800"
                )}
            >
                <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{item.label}</span>
                {showBadge && (
                    <span className="min-w-[24px] px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold text-center">
                        {alerts.length.toLocaleString()}
                    </span>
                )}
            </button>
        );
    };

    return (
        <aside className="w-64 shrink-0 bg-slate-900 flex flex-col h-full border-r border-slate-800 px-3.5 py-5 gap-6">
            {/* Marca */}
            <div className="flex items-center gap-3 px-1.5">
                <div
                    className="w-9 h-9 rounded-[10px] bg-blue-600 text-white flex items-center justify-center font-bold text-lg"
                    aria-hidden="true"
                >
                    Ω
                </div>
                <div>
                    <h1 className="text-white font-bold text-base leading-tight">Omega</h1>
                    <p className="text-slate-400 text-xs">Gestión de inventarios</p>
                </div>
            </div>

            {/* Navegación */}
            <nav aria-label="Secciones" className="flex-1 flex flex-col gap-1">
                {NAV_ITEMS.map(renderItem)}

                <div className="my-3 border-t border-slate-800" />
                <p className="px-3 pb-1 text-xs text-slate-400">Cuando ya tienes datos</p>
                {renderItem(UPDATE_ITEM)}
            </nav>

            {/* Estado de los datos */}
            <div className="bg-slate-800 rounded-xl p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                    <span
                        className={cn("w-2.5 h-2.5 rounded-full", hasData ? "bg-green-400" : "bg-slate-400")}
                        aria-hidden="true"
                    />
                    <span className="text-white text-[13px] font-semibold">
                        {hasData ? "Datos cargados" : "Sin datos"}
                    </span>
                </div>

                <p className="text-xs text-slate-400" title={fileName || undefined}>
                    {hasData
                        ? `${masterData!.length.toLocaleString()} productos guardados en este equipo`
                        : "Carga tus archivos de Excel para empezar."}
                </p>

                {hasData && !confirmClear && (
                    <button
                        onClick={() => setConfirmClear(true)}
                        className="min-h-[44px] px-3 rounded-lg border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition-colors"
                    >
                        Borrar datos
                    </button>
                )}

                {hasData && confirmClear && (
                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] text-white">¿Borrar todo lo cargado? No se puede deshacer.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmClear(false)}
                                className="flex-1 min-h-[44px] rounded-lg border border-slate-600 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleClear}
                                className="flex-1 min-h-[44px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                            >
                                Sí, borrar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};
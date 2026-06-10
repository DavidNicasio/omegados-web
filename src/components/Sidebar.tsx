import React from "react";
import {
    Home,
    RefreshCw,
    Package,
    Bell,
    RefreshCcw,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAppContext } from "../AppContext";

const NAV_ITEMS = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "paso2", label: "Rotación", icon: RefreshCw },
    { id: "inventario", label: "Inventario Maestro", icon: Package },
    { id: "alertas", label: "Alertas", icon: Bell },
    { id: "sync", label: "Sincronizar", icon: RefreshCcw },
];

export const Sidebar: React.FC = () => {
    const { activeView, setActiveView, fileName } = useAppContext();

    return (
        <aside className="w-64 bg-slate-900 flex flex-col h-full border-r border-slate-800">
            <div className="flex flex-col items-center py-6 border-b border-slate-800 px-4">
                <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center mb-3">
                    <span className="text-white text-xl">💊</span>
                </div>
                <h1 className="text-white font-bold text-sm tracking-tight uppercase">
                    Farmacia ERP
                </h1>
                <p className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider mt-1">
                    Inventario y Rotación
                </p>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = activeView === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors font-mono uppercase tracking-wider text-[11px]",
                                isActive
                                    ? "bg-blue-600/10 text-blue-400"
                                    : "text-slate-400 hover:bg-slate-800"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="text-[10px] text-slate-300 font-mono truncate" title={fileName || "Sin maestro cargado"}>
                        {fileName ? fileName : "Sin maestro cargado"}
                    </div>
                </div>
            </div>
        </aside>
    );
};
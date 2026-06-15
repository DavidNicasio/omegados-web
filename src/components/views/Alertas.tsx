import React, { useMemo, useState } from "react";
import { Download, Filter, CloudUpload, Loader2, Search } from "lucide-react";
import { useAppContext } from "../../AppContext";
import { exportToExcel } from "../../lib/excel";
import { SUCURSALES } from "../../lib/constants";
import { toast } from "sonner";
import { createTransferOrders } from "../../services/api";

const Alertas: React.FC = () => {
    const { alerts } = useAppContext();
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("Todas");
    const [sucursalFilter, setSucursalFilter] = useState("TODAS");
    const [page, setPage] = useState(1);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const itemsPerPage = 20;

    const destinations = useMemo(() => {
        const dests = new Set<string>();
        alerts.forEach((a) => {
            if (a.destino && a.destino !== "VARIAS") dests.add(a.destino);
        });
        return Array.from(dests).sort();
    }, [alerts]);

    const filteredAlerts = useMemo(() => {
        let result = alerts;

        // 1. Filtro por Búsqueda (Texto)
        if (search.trim()) {
            const lowerSearch = search.toLowerCase();
            result = result.filter(
                (a) =>
                    (a.clave && a.clave.toLowerCase().includes(lowerSearch)) ||
                    (a.producto && a.producto.toLowerCase().includes(lowerSearch))
            );
        }

        // 2. Filtro por Tipo / Destino
        if (filter === "Solo compras") {
            result = result.filter((a) => a.tipo === "COMPRA");
        } else if (filter !== "Todas") {
            result = result.filter((a) => a.destino === filter);
        }

        // 3. Filtro por Sucursal
        if (sucursalFilter !== "TODAS") {
            result = result.filter(a => a.origen === sucursalFilter || a.destino === sucursalFilter);
        }

        return result;
    }, [alerts, filter, sucursalFilter, search]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredAlerts.length / itemsPerPage)
    );

    const currentPageData = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredAlerts.slice(start, start + itemsPerPage);
    }, [filteredAlerts, page]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilter(e.target.value);
        setPage(1);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1); // Regresamos a la página 1 al buscar
    };

    const handleExport = () => {
        // Usamos filteredAlerts en lugar de alerts para respetar TODOS los filtros aplicados en pantalla
        const traspasos = filteredAlerts.filter((a) => a.tipo === "TRASPASO");

        if (traspasos.length === 0) {
            toast.error("No hay traspasos en la vista actual para exportar.");
            return;
        }

        const exportData = traspasos
            .sort((a, b) => a.origen.localeCompare(b.origen) || a.destino.localeCompare(b.destino))
            .map(a => ({
                Origen: a.origen,
                Destino: a.destino,
                Cantidad: a.cantidad,
                Clave: a.clave,
                Producto: a.producto
            }));

        // Nombre dinámico para saber de qué sucursal son las alertas
        const nombreArchivo = `Traspasos_${sucursalFilter !== "TODAS" ? sucursalFilter : "Filtrados"}.xlsx`;

        exportToExcel(exportData, nombreArchivo);
        toast.success("Excel generado correctamente");
    };

    const handleGenerateCloudOrders = async () => {
        const traspasos = alerts.filter(a => a.tipo === "TRASPASO");
        if (traspasos.length === 0) {
            toast.error("No hay alertas de traspaso generadas.");
            return;
        }

        setLoadingOrders(true);
        const loadingToast = toast.loading("Generando órdenes de traspaso en la nube...");

        try {
            const response = await createTransferOrders(alerts);
            if (response.success) {
                toast.success(response.message || "Órdenes de traspaso generadas en la nube.", { id: loadingToast });
            } else {
                toast.error(response.error || "No se pudieron generar los traspasos.", { id: loadingToast });
            }
        } catch (error: any) {
            toast.error(error.message || "Error contactando la API", { id: loadingToast });
        } finally {
            setLoadingOrders(false);
        }
    };

    const totals = useMemo(() => {
        return {
            traspasos: alerts.filter((a) => a.tipo === "TRASPASO").length,
            compras: alerts.filter((a) => a.tipo === "COMPRA").length,
        };
    }, [alerts]);

    if (alerts.length === 0) {
        return (
            <div className="h-full pt-12 flex flex-col items-center">
                <h2 className="text-xl font-bold mb-8">🔔 Alertas y Sugerencias</h2>
                <div className="text-[#888] flex flex-col items-center gap-2">
                    <span className="text-4xl mb-4">✅</span>
                    <span>Sin alertas pendientes o no hay archivo cargado.</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header className="flex flex-col xl:flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-200 gap-4">
                <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap shrink-0">🔔 Alertas</h2>

                <div className="flex items-center gap-4 flex-1 w-full justify-center flex-wrap xl:flex-nowrap">
                    {/* BUSCADOR (NUEVO) */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por producto o código..."
                            value={search}
                            onChange={handleSearch}
                            className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900 shadow-sm"
                        />
                    </div>

                    {/* FILTROS (EXISTENTES) */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                        <Filter className="w-4 h-4 text-slate-400 hidden sm:block shrink-0" />
                        <select
                            value={filter}
                            onChange={handleFilterChange}
                            className="bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 shadow-sm"
                        >
                            <option value="Todas">Todas (Tipos)</option>
                            <option value="Solo compras">⚠️ Compras</option>
                            <optgroup label="Destinos (Traspasos)">
                                {destinations.map(d => <option key={d} value={d}>Destino: {d}</option>)}
                            </optgroup>
                        </select>

                        <select
                            value={sucursalFilter}
                            onChange={(e) => { setSucursalFilter(e.target.value); setPage(1); }}
                            className="bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 shadow-sm"
                        >
                            <option value="TODAS">Todas (Sucursales)</option>
                            {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {/* BOTONES (EXISTENTES) */}
                <div className="flex items-center gap-2 w-full xl:w-auto shrink-0 justify-end">
                    <button
                        onClick={handleExport}
                        disabled={totals.traspasos === 0}
                        className="flex items-center gap-2 bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200 disabled:opacity-50 px-4 py-2 rounded text-[11px] uppercase font-bold transition-colors tracking-wide"
                    >
                        <Download className="w-4 h-4" /> Exportar Local
                    </button>

                    <button
                        onClick={handleGenerateCloudOrders}
                        disabled={totals.traspasos === 0 || loadingOrders}
                        className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded text-[11px] uppercase font-bold transition-colors tracking-wide shadow-sm"
                    >
                        {loadingOrders ? (
                            <><Loader2 className="w-4 h-4 animate-spin text-white" /> ENVIANDO...</>
                        ) : (
                            <><CloudUpload className="w-4 h-4 text-white" /> Sincronizar Nube</>
                        )}
                    </button>
                </div>
            </header>

            <div className="flex items-center gap-6 px-6 py-4">
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-6 py-4 flex items-center gap-4 min-w-[200px]">
                    <span className="text-blue-600 text-3xl font-bold font-mono">{totals.traspasos}</span>
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-tight">Traspasos<br/>Sugeridos</span>
                </div>
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl px-6 py-4 flex items-center gap-4 min-w-[200px]">
                    <span className="text-red-500 text-3xl font-bold font-mono">{totals.compras}</span>
                    <span className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-tight">Compras<br/>Urgentes</span>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6 pt-2">
                {filteredAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20 text-green-600">
                        <span className="text-2xl mb-2 bg-green-100 p-3 rounded-full">✅</span>
                        <span className="text-sm font-bold uppercase tracking-wide">No hay alertas para tu búsqueda.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-wrap">
                        {currentPageData.map((a, i) => {
                            const isTraspaso = a.tipo === "TRASPASO";
                            const borderColor = isTraspaso ? "border-blue-500" : "border-red-500";
                            const headerColor = isTraspaso ? "bg-blue-500" : "bg-red-500";

                            return (
                                <div key={i} className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col`}>
                                    <div className={`h-1.5 shadow-sm ${headerColor}`}></div>
                                    <div className="p-5 flex flex-col h-full hover:bg-slate-50 transition-colors">
                                        <h4 className="font-bold text-sm truncate mb-1 text-slate-800" title={a.producto}>{a.producto || "Sin nombre"}</h4>
                                        <p className="text-[11px] font-mono text-slate-500 mb-5">ID: {a.clave}</p>

                                        <div className="mt-auto flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                                            {isTraspaso ? (
                                                <>
                                                    <span className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] uppercase font-bold truncate max-w-[80px] text-center" title={a.origen}>{a.origen}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest">→ {a.cantidad} →</span>
                                                    <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] uppercase font-bold truncate max-w-[80px] text-center" title={a.destino}>{a.destino}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] uppercase font-bold truncate max-w-[90px] text-center" title={a.origen}>🛒 {a.origen}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest">→ BUY →</span>
                                                    <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded text-[10px] uppercase font-bold truncate max-w-[80px] text-center">URGENTE</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200">
                <button
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="px-6 py-2 bg-white border border-slate-300 rounded shadow-sm text-xs font-bold hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-white uppercase tracking-wider"
                >
                    &larr; Prev
                </button>
                <span className="text-[11px] text-slate-500 font-mono uppercase tracking-widest">
          PAGE {page} OF {totalPages} • {filteredAlerts.length} ITEMS
        </span>
                <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                    className="px-6 py-2 bg-white border border-slate-300 rounded shadow-sm text-xs font-bold hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-white uppercase tracking-wider"
                >
                    Next &rarr;
                </button>
            </div>
        </div>
    );
};

export default Alertas;
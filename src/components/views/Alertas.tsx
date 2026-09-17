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
    const [tipoFilter, setTipoFilter] = useState<"TODAS" | "TRASPASO" | "COMPRA">("TODAS");
    const [sucursalFilter, setSucursalFilter] = useState("TODAS");
    const [destinoFilter, setDestinoFilter] = useState("TODOS");
    const [page, setPage] = useState(1);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const itemsPerPage = 20;

    const destinations = useMemo(() => {
        const dests = new Set<string>();
        alerts.forEach((a) => {
            if (a.tipo === "TRASPASO" && a.destino && a.destino !== "VARIAS") {
                dests.add(a.destino);
            }
        });
        return Array.from(dests).sort();
    }, [alerts]);

    const totals = useMemo(() => {
        return {
            total: alerts.length,
            traspasos: alerts.filter((a) => a.tipo === "TRASPASO").length,
            compras: alerts.filter((a) => a.tipo === "COMPRA").length,
        };
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

        // 2. Filtro por Tipo de Alerta
        if (tipoFilter === "COMPRA") {
            result = result.filter((a) => a.tipo === "COMPRA");
        } else if (tipoFilter === "TRASPASO") {
            result = result.filter((a) => a.tipo === "TRASPASO");
        }

        // 3. Filtro por Sucursal
        if (sucursalFilter !== "TODAS") {
            const sucUp = sucursalFilter.toUpperCase();
            result = result.filter(a => {
                if (a.tipo === "TRASPASO") {
                    return a.origen === sucUp || a.destino === sucUp;
                } else {
                    // Si es COMPRA: comprobar si la sucursal es destino, o vendió el producto
                    return a.destino === sucUp ||
                           a.destino.includes(sucUp) ||
                           (a.sucursales && a.sucursales.includes(sucUp)) ||
                           a.destino === "VARIAS";
                }
            });
        }

        // 4. Filtro por Destino (si se seleccionó un destino específico)
        if (destinoFilter !== "TODOS") {
            result = result.filter(a => a.destino === destinoFilter);
        }

        return result;
    }, [alerts, tipoFilter, sucursalFilter, destinoFilter, search]);

    const totalPages = Math.max(
        1,
        Math.ceil(filteredAlerts.length / itemsPerPage)
    );

    const currentPageData = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredAlerts.slice(start, start + itemsPerPage);
    }, [filteredAlerts, page]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleExport = () => {
        if (filteredAlerts.length === 0) {
            toast.error("No hay alertas en la vista actual para exportar.");
            return;
        }

        const exportData = filteredAlerts
            .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.origen.localeCompare(b.origen) || a.destino.localeCompare(b.destino))
            .map(a => ({
                "Tipo de Alerta": a.tipo,
                "Clave": a.clave,
                "Producto": a.producto,
                "Origen": a.origen,
                "Destino / Sucursal": a.destino,
                "Cantidad": a.cantidad
            }));

        const sucStr = sucursalFilter !== "TODAS" ? sucursalFilter : "Global";
        let nombreArchivo = `Alertas_${sucStr}.xlsx`;
        if (tipoFilter === "COMPRA") {
            nombreArchivo = `Compras_Urgentes_${sucStr}.xlsx`;
        } else if (tipoFilter === "TRASPASO") {
            nombreArchivo = `Traspasos_Sugeridos_${sucStr}.xlsx`;
        }

        exportToExcel(exportData, nombreArchivo);
        toast.success(`Excel generado correctamente con ${exportData.length} alertas.`);
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
                    {/* BUSCADOR */}
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

                    {/* SELECTORES DE FILTRO */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                        <Filter className="w-4 h-4 text-slate-400 hidden sm:block shrink-0" />
                        
                        {/* FILTRO DE TIPO */}
                        <select
                            value={tipoFilter}
                            onChange={(e) => {
                                setTipoFilter(e.target.value as "TODAS" | "TRASPASO" | "COMPRA");
                                setPage(1);
                            }}
                            className="bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 shadow-sm"
                        >
                            <option value="TODAS">Todos los tipos ({totals.total})</option>
                            <option value="TRASPASO">🔄 Traspasos Sugeridos ({totals.traspasos})</option>
                            <option value="COMPRA">🛒 Compras Urgentes ({totals.compras})</option>
                        </select>

                        {/* FILTRO DE SUCURSAL */}
                        <select
                            value={sucursalFilter}
                            onChange={(e) => { setSucursalFilter(e.target.value); setPage(1); }}
                            className="bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 shadow-sm"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        {/* FILTRO DE DESTINO (DISPONIBLE PARA TRASPASOS) */}
                        {tipoFilter === "TRASPASO" && destinations.length > 0 && (
                            <select
                                value={destinoFilter}
                                onChange={(e) => { setDestinoFilter(e.target.value); setPage(1); }}
                                className="bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 shadow-sm"
                            >
                                <option value="TODOS">Cualquier Destino</option>
                                {destinations.map(d => <option key={d} value={d}>Destino: {d}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="flex items-center gap-2 w-full xl:w-auto shrink-0 justify-end">
                    <button
                        onClick={handleExport}
                        disabled={filteredAlerts.length === 0}
                        className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 px-4 py-2 rounded text-[11px] uppercase font-bold transition-colors tracking-wide shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Exportar {tipoFilter === "COMPRA" ? "Compras" : tipoFilter === "TRASPASO" ? "Traspasos" : "Alertas"} ({filteredAlerts.length})
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

            {/* TARJETAS INTERACTIVAS DE RESUMEN / FILTRO RÁPIDO */}
            <div className="flex items-center gap-4 px-6 py-4 flex-wrap">
                <button
                    onClick={() => { setTipoFilter("TODAS"); setPage(1); }}
                    className={`border shadow-sm rounded-xl px-5 py-3 flex items-center gap-4 transition-all cursor-pointer ${
                        tipoFilter === "TODAS"
                            ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <span className="text-2xl font-bold font-mono">{totals.total}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest leading-tight text-left ${tipoFilter === "TODAS" ? "text-slate-300" : "text-slate-500"}`}>
                        Todas las<br />Alertas
                    </span>
                </button>

                <button
                    onClick={() => { setTipoFilter("TRASPASO"); setPage(1); }}
                    className={`border shadow-sm rounded-xl px-5 py-3 flex items-center gap-4 transition-all cursor-pointer ${
                        tipoFilter === "TRASPASO"
                            ? "bg-blue-600 text-white border-blue-600 ring-2 ring-blue-600/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <span className={`text-2xl font-bold font-mono ${tipoFilter === "TRASPASO" ? "text-white" : "text-blue-600"}`}>{totals.traspasos}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest leading-tight text-left ${tipoFilter === "TRASPASO" ? "text-blue-100" : "text-slate-500"}`}>
                        Traspasos<br />Sugeridos
                    </span>
                </button>

                <button
                    onClick={() => { setTipoFilter("COMPRA"); setPage(1); }}
                    className={`border shadow-sm rounded-xl px-5 py-3 flex items-center gap-4 transition-all cursor-pointer ${
                        tipoFilter === "COMPRA"
                            ? "bg-red-600 text-white border-red-600 ring-2 ring-red-600/20"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                >
                    <span className={`text-2xl font-bold font-mono ${tipoFilter === "COMPRA" ? "text-white" : "text-red-500"}`}>{totals.compras}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest leading-tight text-left ${tipoFilter === "COMPRA" ? "text-red-100" : "text-slate-500"}`}>
                        Compras<br />Urgentes
                    </span>
                </button>
            </div>

            {/* LISTA / GRID DE ALERTAS */}
            <div className="flex-1 overflow-auto p-6 pt-2">
                {filteredAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-20 text-slate-500">
                        <span className="text-3xl mb-2">🔍</span>
                        <span className="text-sm font-bold uppercase tracking-wide">No se encontraron alertas para los filtros seleccionados.</span>
                        <p className="text-xs text-slate-400 mt-1">Prueba cambiando la sucursal o el tipo de alerta.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-wrap">
                        {currentPageData.map((a, i) => {
                            const isTraspaso = a.tipo === "TRASPASO";
                            const headerColor = isTraspaso ? "bg-blue-500" : "bg-red-500";

                            return (
                                <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                    <div className={`h-1.5 shadow-sm ${headerColor}`}></div>
                                    <div className="p-5 flex flex-col h-full hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                                isTraspaso ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"
                                            }`}>
                                                {isTraspaso ? "🔄 Traspaso" : "🛒 Compra Urgente"}
                                            </span>
                                            <span className="text-[10px] font-mono text-slate-400">#{i + 1 + (page - 1) * itemsPerPage}</span>
                                        </div>

                                        <h4 className="font-bold text-sm truncate mb-1 text-slate-800" title={a.producto}>{a.producto || "Sin nombre"}</h4>
                                        <p className="text-[11px] font-mono text-slate-500 mb-5">ID: {a.clave}</p>

                                        <div className="mt-auto flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                                            {isTraspaso ? (
                                                <>
                                                    <span className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] uppercase font-bold truncate max-w-[85px] text-center" title={a.origen}>{a.origen}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest">→ {a.cantidad} →</span>
                                                    <span className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[10px] uppercase font-bold truncate max-w-[85px] text-center" title={a.destino}>{a.destino}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="px-2 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] uppercase font-bold truncate max-w-[90px] text-center" title={a.origen}>🛒 {a.origen}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 font-mono tracking-widest">→ PEDIR →</span>
                                                    <span className="px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded text-[10px] uppercase font-bold truncate max-w-[90px] text-center" title={a.destino}>{a.destino}</span>
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

            {/* PAGINACIÓN */}
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
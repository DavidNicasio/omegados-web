import React, { useMemo, useState } from "react";
import { Search, Columns, Download } from "lucide-react";
import { useAppContext } from "../../AppContext";
import { STOCK_BAJO, SUCURSALES, MESES } from "../../lib/constants";
import { exportToExcel } from "../../lib/excel";
import { ESTADOS, ORDEN_ESTADOS, esEstadoRotacion } from "../../lib/estados";
import { cn, limpiarNombreProducto, nombreSucursal } from "../../lib/utils";

const ANCHO_CLAVE = 128; // px, la columna Producto se pega justo después

const esColumnaExistencia = (c: string) => c === "Exist" || SUCURSALES.includes(c);

// Solo las celdas con problema llevan color: sin existencia (rojo) y existencia baja (ámbar)
const claseExistencia = (valor: number) => {
    if (valor <= 0) return "bg-[#FEE2E2] text-[#991B1B] font-semibold";
    if (valor <= STOCK_BAJO) return "bg-[#FEF3C7] text-[#92400E] font-semibold";
    return "text-slate-900";
};

const ChipRotacion: React.FC<{ valor: string }> = ({ valor }) => {
    if (!esEstadoRotacion(valor)) return <span className="text-slate-500">—</span>;
    const e = ESTADOS[valor];
    return (
        <span
            className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: e.chipBg, color: e.chipFg }}
        >
            {e.etiqueta}
        </span>
    );
};

const Inventario: React.FC = () => {
    const { masterData, cols: globalCols, inventarioUI: ui, setInventarioUI } = useAppContext();
    const { search, sucursal: sucursalFilter, mes: mesFilter, anio: añoFilter, hiddenSuc, showRotCols } = ui;
    const [colsOpen, setColsOpen] = useState(false);
    const itemsPerPage = 25;

    const { availableMeses, availableYears } = useMemo(() => {
        const mesSet = new Set<string>();
        const yearSet = new Set<string>();

        globalCols.forEach((c) => {
            // Ignorar columnas internas o calculadas de sistema
            if (c.startsWith("Rotacion_") || c.startsWith("Ventas_") || c === "Estado_Rotacion") return;

            const parts = c.split("_");
            if (parts.length > 1) {
                const sub = parts.slice(1).join("_").toUpperCase();

                const foundMes = MESES.find((m) => sub.startsWith(m) || sub.includes(m));
                if (foundMes) mesSet.add(foundMes);

                const yearMatch = sub.match(/[0-9]{2,4}/);
                if (yearMatch) yearSet.add(yearMatch[0]);
            }
        });
        return {
            availableMeses: Array.from(mesSet).sort((a, b) => MESES.indexOf(a) - MESES.indexOf(b)),
            availableYears: Array.from(yearSet).sort((a, b) => Number(a) - Number(b)),
        };
    }, [globalCols]);

    const visibleCols = useMemo(() => {
        return globalCols.filter((c) => {
            // Clave, Artículo, Exist y Estado_Rotacion siempre visibles
            if (c === "Clave" || c === "Artículo" || c === "Exist" || c === "Estado_Rotacion") return true;

            const upper = c.toUpperCase();

            // Si filtramos por una sucursal específica, su columna principal SIEMPRE debe ser visible
            if (sucursalFilter !== "TODAS" && upper === sucursalFilter.toUpperCase()) return true;

            // Columnas que el usuario decidió ocultar
            if (c.startsWith("Rotacion_")) {
                if (!showRotCols || hiddenSuc[c.slice("Rotacion_".length)]) return false;
            } else if (hiddenSuc[upper]) {
                return false;
            }

            let matchSuc = true;
            if (sucursalFilter !== "TODAS") {
                matchSuc = upper === sucursalFilter || upper.startsWith(sucursalFilter + "_");
            }

            let matchMes = true;
            let matchAño = true;
            if (mesFilter !== "TODOS" || añoFilter !== "TODOS") {
                const parts = c.split("_");
                if (parts.length > 1) {
                    const sub = parts.slice(1).join("_").toUpperCase();
                    const foundMes = MESES.find((m) => sub.startsWith(m) || sub.includes(m));
                    const yearMatch = sub.match(/[0-9]{2,4}/);

                    const monthPart = foundMes || sub;
                    const yearPart = yearMatch ? yearMatch[0] : "";

                    if (mesFilter !== "TODOS") matchMes = monthPart === mesFilter;
                    if (añoFilter !== "TODOS" && availableYears.length > 0) matchAño = yearPart === añoFilter;
                } else {
                    matchMes = false;
                    matchAño = false;
                }
            }

            return matchSuc && matchMes && matchAño;
        });
    }, [globalCols, sucursalFilter, mesFilter, añoFilter, availableYears, hiddenSuc, showRotCols]);

    const filteredData = useMemo(() => {
        if (!masterData) return [];
        if (!search.trim()) return masterData;
        const lower = search.toLowerCase();
        return masterData.filter((r) => r.clave.toLowerCase().includes(lower) || r.articulo.toLowerCase().includes(lower));
    }, [masterData, search]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const page = Math.min(ui.page, totalPages);
    const currentPageData = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredData.slice(start, start + itemsPerPage);
    }, [filteredData, page]);

    const handleExport = () => {
        if (!filteredData || filteredData.length === 0) return;

        // Se exporta el nombre original del producto (r.raw), no el nombre limpio de la pantalla
        const exportData = filteredData.map((r) => {
            const rowCopy = { ...r.raw };
            // Si se filtró por una sucursal, su rotación individual va en 'Estado_Rotacion'
            if (sucursalFilter !== "TODAS") {
                const keyIndividual = `Rotacion_${sucursalFilter.toUpperCase()}`;
                rowCopy["Estado_Rotacion"] = r.raw[keyIndividual] || "SIN MOVIMIENTO";
            }
            return rowCopy;
        });

        // Asegurar que las columnas a exportar incluyan la sucursal filtrada
        const colsToExport = [...visibleCols];
        if (sucursalFilter !== "TODAS") {
            const sucUpper = sucursalFilter.toUpperCase();
            if (!colsToExport.includes(sucUpper)) {
                const rotIndex = colsToExport.indexOf("Estado_Rotacion");
                if (rotIndex !== -1) colsToExport.splice(rotIndex, 0, sucUpper);
                else colsToExport.push(sucUpper);
            }
        }

        exportToExcel(exportData, `Maestro_${sucursalFilter !== "TODAS" ? sucursalFilter : "Global"}.xlsx`, colsToExport);
    };

    const encabezado = (c: string): { titulo: string; sub?: string } => {
        if (c === "Clave") return { titulo: "Clave" };
        if (c === "Artículo") return { titulo: "Producto" };
        if (c === "Exist") return { titulo: "Existencia", sub: "Total" };
        if (c === "Ventas_Global") return { titulo: "Ventas", sub: "Total" };
        if (c === "Estado_Rotacion") {
            return { titulo: "Rotación", sub: sucursalFilter !== "TODAS" ? nombreSucursal(sucursalFilter) : "Global" };
        }
        if (c.startsWith("Rotacion_")) return { titulo: "Rotación", sub: nombreSucursal(c.slice("Rotacion_".length)) };
        if (SUCURSALES.includes(c)) return { titulo: nombreSucursal(c) };
        if (c.includes("_")) {
            const parts = c.split("_");
            return { titulo: parts[0], sub: parts.slice(1).join("_") };
        }
        return { titulo: c };
    };

    if (!masterData) {
        return (
            <div className="h-full flex items-center justify-center text-[#475569] text-base text-center px-8">
                Todavía no hay datos cargados. Ve a "1. Cargar datos" para empezar.
            </div>
        );
    }

    const selectClase =
        "min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]";

    return (
        <div className="flex flex-col h-full bg-[#F6F8FB]">
            <header className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-200 gap-4">
                <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">Inventario</h2>

                <div className="flex items-center gap-3 flex-1 justify-center w-full max-w-3xl flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Buscar por nombre o clave"
                            placeholder="Buscar por nombre o clave"
                            value={search}
                            onChange={(e) => setInventarioUI({ search: e.target.value, page: 1 })}
                            className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg pl-10 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                    </div>

                    <select
                        aria-label="Filtrar por sucursal"
                        value={sucursalFilter}
                        onChange={(e) => setInventarioUI({ sucursal: e.target.value, page: 1 })}
                        className={selectClase}
                    >
                        <option value="TODAS">Todas las sucursales</option>
                        {SUCURSALES.map((s) => (
                            <option key={s} value={s}>
                                {nombreSucursal(s)}
                            </option>
                        ))}
                    </select>
                    {availableMeses.length > 0 && (
                        <select
                            aria-label="Filtrar por mes"
                            value={mesFilter}
                            onChange={(e) => setInventarioUI({ mes: e.target.value, page: 1 })}
                            className={selectClase}
                        >
                            <option value="TODOS">Todos los meses</option>
                            {availableMeses.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                        </select>
                    )}
                    {availableYears.length > 0 && (
                        <select
                            aria-label="Filtrar por año"
                            value={añoFilter}
                            onChange={(e) => setInventarioUI({ anio: e.target.value, page: 1 })}
                            className={selectClase}
                        >
                            <option value="TODOS">Todos los años</option>
                            {availableYears.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div
                        className="relative flex-1 sm:flex-none"
                        onKeyDown={(e) => {
                            if (e.key === "Escape") setColsOpen(false);
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setColsOpen((o) => !o)}
                            aria-expanded={colsOpen}
                            className="w-full flex items-center justify-center gap-2 min-h-[44px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 rounded-lg text-sm font-semibold transition-colors"
                        >
                            <Columns className="w-4 h-4" aria-hidden="true" /> Columnas visibles
                        </button>

                        {colsOpen && (
                            <div
                                role="group"
                                aria-label="Columnas visibles"
                                className="absolute right-0 top-[52px] z-40 w-72 max-h-96 overflow-auto bg-white border border-slate-300 rounded-xl shadow-lg p-3"
                            >
                                <div className="flex items-center justify-between pb-2">
                                    <span className="text-sm font-semibold text-slate-800">Sucursales</span>
                                    <button
                                        type="button"
                                        onClick={() => setInventarioUI({ hiddenSuc: {} })}
                                        className="min-h-[44px] px-2 text-sm font-semibold text-[#2563EB] hover:text-blue-800"
                                    >
                                        Mostrar todas
                                    </button>
                                </div>

                                {SUCURSALES.map((s) => (
                                    <label key={s} className="flex items-center gap-3 min-h-[44px] px-1 text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-[#2563EB]"
                                            checked={!hiddenSuc[s]}
                                            onChange={() => setInventarioUI({ hiddenSuc: { ...hiddenSuc, [s]: !hiddenSuc[s] } })}
                                        />
                                        {nombreSucursal(s)}
                                    </label>
                                ))}

                                <div className="mt-2 pt-2 border-t border-slate-200">
                                    <label className="flex items-center gap-3 min-h-[44px] px-1 text-sm text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-[#2563EB]"
                                            checked={showRotCols}
                                            onChange={() => setInventarioUI({ showRotCols: !showRotCols })}
                                        />
                                        Mostrar la rotación de cada sucursal
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleExport}
                        className="flex items-center justify-center flex-1 sm:flex-none gap-2 min-h-[44px] bg-[#0F172A] hover:bg-slate-800 text-white px-4 rounded-lg text-sm font-semibold transition-colors"
                    >
                        <Download className="w-4 h-4" aria-hidden="true" /> Exportar a Excel
                    </button>
                </div>
            </header>

            <details className="px-6 py-3 bg-white border-b border-slate-200 text-sm text-slate-800">
                <summary className="min-h-[44px] flex items-center cursor-pointer font-semibold text-[#2563EB]">
                    ¿Qué significan los colores y los estados?
                </summary>
                <div className="pb-3 flex flex-col gap-4 md:flex-row md:gap-10">
                    <div>
                        <p className="font-semibold mb-2">Estados de rotación</p>
                        <ul className="flex flex-col gap-1.5">
                            {ORDEN_ESTADOS.map((k) => (
                                <li key={k} className="flex items-center gap-2">
                                    <span
                                        className="inline-block min-w-[118px] text-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                                        style={{ backgroundColor: ESTADOS[k].chipBg, color: ESTADOS[k].chipFg }}
                                    >
                                        {ESTADOS[k].etiqueta}
                                    </span>
                                    <span className="text-[#475569]">{ESTADOS[k].ayuda}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <p className="font-semibold mb-2">Colores en las existencias</p>
                        <ul className="flex flex-col gap-1.5">
                            <li className="flex items-center gap-2">
                                <span className="inline-block min-w-[44px] text-center px-2 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B] text-xs font-semibold">0</span>
                                <span className="text-[#475569]">Sin existencia.</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="inline-block min-w-[44px] text-center px-2 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-xs font-semibold">1-{STOCK_BAJO}</span>
                                <span className="text-[#475569]">Existencia baja ({STOCK_BAJO} piezas o menos).</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="inline-block min-w-[44px] text-center px-2 py-0.5 text-xs font-semibold text-slate-900">{STOCK_BAJO + 1}+</span>
                                <span className="text-[#475569]">Existencia normal, sin color.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </details>

            <div className="flex-1 overflow-hidden p-6 relative flex flex-col">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1 w-full">
                    <table className="w-full text-left border-separate border-spacing-0 text-xs whitespace-nowrap min-w-max">
                        <thead>
                            <tr>
                                {visibleCols.map((c) => {
                                    const h = encabezado(c);
                                    const esClave = c === "Clave";
                                    const esProducto = c === "Artículo";
                                    return (
                                        <th
                                            key={c}
                                            scope="col"
                                            style={esClave ? { width: ANCHO_CLAVE, minWidth: ANCHO_CLAVE } : esProducto ? { left: ANCHO_CLAVE } : undefined}
                                            className={cn(
                                                "py-2.5 px-4 font-semibold text-slate-700 bg-slate-100 border-b-2 border-slate-300 sticky top-0 min-w-[84px]",
                                                esClave && "left-0 z-30",
                                                esProducto && "z-30 w-72 min-w-[288px] border-r border-slate-300",
                                                !esClave && !esProducto && "z-20"
                                            )}
                                        >
                                            <div className="flex flex-col leading-tight">
                                                <span>{h.titulo}</span>
                                                {h.sub && <span className="text-[#2563EB] font-medium">{h.sub}</span>}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {currentPageData.map((row, i) => (
                                <tr key={`${row.clave}-${i}`} className="group">
                                    {visibleCols.map((c) => {
                                        let valor: any = row.raw[c];

                                        // Con una sucursal elegida, la columna Rotación muestra la de esa sucursal
                                        if (c === "Estado_Rotacion" && sucursalFilter !== "TODAS") {
                                            valor = row.raw[`Rotacion_${sucursalFilter.toUpperCase()}`] || "SIN MOVIMIENTO";
                                        }

                                        const base = "py-2.5 px-4 border-b border-slate-200";

                                        if (c === "Clave") {
                                            return (
                                                <td
                                                    key={c}
                                                    style={{ width: ANCHO_CLAVE, minWidth: ANCHO_CLAVE }}
                                                    className={cn(base, "sticky left-0 z-10 bg-white group-hover:bg-slate-50 text-slate-700")}
                                                >
                                                    {valor}
                                                </td>
                                            );
                                        }

                                        if (c === "Artículo") {
                                            const nombre = limpiarNombreProducto(String(row.articulo));
                                            return (
                                                <td
                                                    key={c}
                                                    style={{ left: ANCHO_CLAVE }}
                                                    className={cn(
                                                        base,
                                                        "sticky z-10 bg-white group-hover:bg-slate-50 w-72 min-w-[288px] max-w-[288px] truncate border-r border-slate-300 text-slate-900 font-medium"
                                                    )}
                                                    title={nombre}
                                                >
                                                    {nombre}
                                                </td>
                                            );
                                        }

                                        if (c === "Estado_Rotacion" || c.startsWith("Rotacion_")) {
                                            return (
                                                <td key={c} className={cn(base, "text-center group-hover:bg-slate-50")}>
                                                    <ChipRotacion valor={String(valor)} />
                                                </td>
                                            );
                                        }

                                        if (valor === "" || valor === null || valor === undefined) {
                                            return (
                                                <td key={c} className={cn(base, "text-center text-slate-500 group-hover:bg-slate-50")}>
                                                    —
                                                </td>
                                            );
                                        }

                                        const esNumero = typeof valor === "number";
                                        return (
                                            <td
                                                key={c}
                                                className={cn(
                                                    base,
                                                    esNumero && "text-right",
                                                    esNumero && esColumnaExistencia(c) ? claseExistencia(valor) : "text-slate-900 group-hover:bg-slate-50"
                                                )}
                                            >
                                                {esNumero ? valor.toLocaleString("es-MX") : String(valor)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {currentPageData.length === 0 && (
                        <div className="p-8 text-center text-[#475569]">No encontramos productos con esa búsqueda.</div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200 gap-3 flex-wrap">
                <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setInventarioUI({ page: page - 1 })}
                    className="min-h-[44px] px-5 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white"
                >
                    &larr; Anterior
                </button>
                <span className="text-sm text-[#475569]">
                    Página {page} de {totalPages} · {filteredData.length.toLocaleString("es-MX")} productos
                </span>
                <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setInventarioUI({ page: page + 1 })}
                    className="min-h-[44px] px-5 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white"
                >
                    Siguiente &rarr;
                </button>
            </div>
        </div>
    );
};

export default Inventario;

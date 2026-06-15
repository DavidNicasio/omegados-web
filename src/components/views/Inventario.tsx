import React, {useMemo, useState} from "react";
import {Search, Columns, Save, Filter} from "lucide-react";
import {useAppContext} from "../../AppContext";
import {STOCK_BAJO, SUCURSALES} from "../../lib/constants";
import {exportToExcel} from "../../lib/excel";

const Inventario: React.FC = () => {
    const {masterData, cols: globalCols} = useAppContext();
    const [search, setSearch] = useState("");
    const [sucursalFilter, setSucursalFilter] = useState("TODAS");
    const [mesFilter, setMesFilter] = useState("TODOS");
    const [añoFilter, setAñoFilter] = useState("TODOS");
    const [page, setPage] = useState(1);
    const itemsPerPage = 25;

    const {availableMeses, availableYears} = useMemo(() => {
        const mesSet = new Set<string>();
        const yearSet = new Set<string>();

        globalCols.forEach(c => {
            const parts = c.split('_');
            if (parts.length > 1) {
                const sub = parts.slice(1).join('_').toUpperCase();

                const monthMatch = sub.match(/[A-ZÁÉÍÓÚ]+/i);
                const yearMatch = sub.match(/[0-9]{2,4}/);

                if (monthMatch) mesSet.add(monthMatch[0].toUpperCase());
                else mesSet.add(sub);

                if (yearMatch) yearSet.add(yearMatch[0]);
            }
        });
        return {
            availableMeses: Array.from(mesSet).sort(),
            availableYears: Array.from(yearSet).sort((a, b) => Number(a) - Number(b))
        };
    }, [globalCols]);

    const visibleCols = useMemo(() => {
        return globalCols.filter(c => {
            // Agregamos 'Estado_Rotacion' para que SIEMPRE sea visible, incluso con filtros
            if (c === 'Clave' || c === 'Artículo' || c === 'Exist' || c === 'Estado_Rotacion') return true;
            const upper = c.toUpperCase();
            let matchSuc = true;
            if (sucursalFilter !== "TODAS") {
                matchSuc = upper === sucursalFilter || upper.startsWith(sucursalFilter + "_");
            }

            let matchMes = true;
            let matchAño = true;
            if (mesFilter !== "TODOS" || añoFilter !== "TODOS") {
                const parts = c.split('_');
                if (parts.length > 1) {
                    const sub = parts.slice(1).join('_').toUpperCase();
                    const monthMatch = sub.match(/[A-ZÁÉÍÓÚ]+/i);
                    const yearMatch = sub.match(/[0-9]{2,4}/);

                    const monthPart = monthMatch ? monthMatch[0].toUpperCase() : sub;
                    const yearPart = yearMatch ? yearMatch[0] : "";

                    if (mesFilter !== "TODOS") {
                        matchMes = monthPart === mesFilter;
                    }
                    if (añoFilter !== "TODOS" && availableYears.length > 0) {
                        matchAño = yearPart === añoFilter;
                    }
                } else {
                    matchMes = false;
                    matchAño = false;
                }
            }

            return matchSuc && matchMes && matchAño;
        });
    }, [globalCols, sucursalFilter, mesFilter, añoFilter, availableYears]);

    const filteredData = useMemo(() => {
        if (!masterData) return [];
        if (!search.trim()) return masterData;
        const lower = search.toLowerCase();
        return masterData.filter(
            (r) =>
                r.clave.toLowerCase().includes(lower) ||
                r.articulo.toLowerCase().includes(lower)
        );
    }, [masterData, search]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const currentPageData = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredData.slice(start, start + itemsPerPage);
    }, [filteredData, page]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
        setPage(1);
    };

    const handleExport = () => {
        if (!filteredData || filteredData.length === 0) return;

        // Obtenemos SOLO los datos que pasaron por el filtro (texto)
        const exportData = filteredData.map(r => r.raw);

        // Nombre dinámico para que el cliente sepa qué sucursal exportó
        const nombreArchivo = `Maestro_${sucursalFilter !== "TODAS" ? sucursalFilter : "Global"}.xlsx`;

        // Mandamos visibleCols para que ignore las sucursales que no queremos ver
        exportToExcel(exportData, nombreArchivo, visibleCols);
    };

    if (!masterData) {
        return (
            <div className="h-full flex items-center justify-center text-slate-500 font-mono tracking-wider">
                NO DATA LOADED. PLEASE SELECT A MASTER FILE.
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#f8fafc]">
            <header
                className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-200 gap-4">
                <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">📦 Inventario Maestro</h2>

                <div className="flex items-center gap-4 flex-1 justify-center w-full max-w-3xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o código..."
                            value={search}
                            onChange={handleSearch}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900"
                        />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <Filter className="w-4 h-4 text-slate-400 shrink-0"/>
                        <select
                            value={sucursalFilter}
                            onChange={(e) => {
                                setSucursalFilter(e.target.value);
                                setPage(1);
                            }}
                            className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 text-slate-700 shadow-sm"
                        >
                            <option value="TODAS">Todas las Sucursales</option>
                            {SUCURSALES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {availableMeses.length > 0 && (
                            <select
                                value={mesFilter}
                                onChange={(e) => {
                                    setMesFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 text-slate-700 shadow-sm w-[130px]"
                            >
                                <option value="TODOS">Mes: Todos</option>
                                {availableMeses.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        )}
                        {availableYears.length > 0 && (
                            <select
                                value={añoFilter}
                                onChange={(e) => {
                                    setAñoFilter(e.target.value);
                                    setPage(1);
                                }}
                                className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 text-slate-700 shadow-sm w-[130px]"
                            >
                                <option value="TODOS">Año: Todos</option>
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                        className="flex items-center justify-center flex-1 sm:flex-none gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded shadow-sm text-xs font-bold transition-colors uppercase">
                        <Columns className="w-4 h-4"/> Columnas
                    </button>
                    <button onClick={handleExport}
                            className="flex items-center justify-center flex-1 sm:flex-none gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded shadow text-xs font-bold transition-colors uppercase">
                        <Save className="w-4 h-4"/> Guardar
                    </button>
                </div>
            </header>

            <div
                className="flex items-center gap-6 px-6 py-3 bg-slate-50/80 text-[10px] border-b border-slate-200 font-medium uppercase tracking-wider text-slate-500 overflow-x-auto">
                <span className="shrink-0">Color de filas:</span>
                <span className="text-red-600 flex items-center gap-1 shrink-0"><span
                    className="w-2 h-2 rounded-full bg-red-500"></span> Sin existencia / Crítico</span>
                <span className="text-amber-600 flex items-center gap-1 shrink-0"><span
                    className="w-2 h-2 rounded-full bg-amber-500"></span> Existencia baja</span>
                <span className="text-green-600 flex items-center gap-1 shrink-0"><span
                    className="w-2 h-2 rounded-full bg-green-500"></span> Existencia normal</span>
            </div>

            <div className="flex-1 overflow-hidden p-6 relative flex flex-col">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto flex-1 w-full">
                    <table
                        className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-max border-slate-300">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] tracking-wider relative z-10 shadow-sm border-b-2 border-slate-300">
                        <tr>
                            {visibleCols.map((c) => {
                                let headerRender: React.ReactNode = <>{c}</>;

                                if (c === 'Estado_Rotacion') {
                                    headerRender = (
                                        <div className="flex flex-col items-start leading-tight">
                                            <span>Rotación</span>
                                            <span className="text-[9px] text-blue-600 font-bold tracking-widest">
                                  {sucursalFilter !== "TODAS" ? sucursalFilter : "GLOBAL"}
                              </span>
                                        </div>
                                    );
                                } else if (c !== 'Clave' && c !== 'Artículo' && c !== 'Exist' && c.includes('_')) {
                                    const parts = c.split('_');
                                    const sucName = parts[0];
                                    const sub = parts.slice(1).join('_');
                                    headerRender = (
                                        <div className="flex flex-col items-start leading-tight">
                                            <span>{sucName}</span>
                                            <span className="text-[9px] text-blue-600 font-bold tracking-widest">{sub}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <th key={c} className="py-2.5 px-4 font-bold border-r border-slate-300 last:border-r-0 sticky top-0 bg-slate-100 min-w-[80px]">
                                        {headerRender}
                                    </th>
                                );
                            })}
                        </tr>
                        </thead>
                        <tbody>
                        {currentPageData.map((row, i) => {
                            return (
                                <tr key={`${row.clave}-${i}`} className={`transition-colors font-medium border-b border-slate-200 hover:bg-slate-50 bg-white`}>
                                    {visibleCols.map((c) => {
                                        // 1. OBTENEMOS EL VALOR ORIGINAL DE LA CELDA
                                        let displayValue: any = row.raw[c];

                                        // -----------------------------------------------------------------
                                        // INTERCEPCIÓN DE ROTACIÓN INDIVIDUAL
                                        // -----------------------------------------------------------------
                                        if (c === "Estado_Rotacion" && sucursalFilter !== "TODAS") {
                                            const keyIndividual = `Rotacion_${sucursalFilter.toUpperCase()}`;
                                            displayValue = row.raw[keyIndividual] || "SIN MOVIMIENTO";
                                        }

                                        // 2. LÓGICA DE ESTILOS ORIGINALES
                                        let cellClass = "py-2.5 px-4 border-r border-slate-300/40 last:border-r-0 font-mono text-[13px] ";
                                        let content: React.ReactNode = displayValue;

                                        if (displayValue === "" || displayValue === null || displayValue === undefined) {
                                            content = <span className="text-slate-300 select-none">—</span>;
                                            cellClass += "text-center ";
                                        } else if (typeof displayValue === 'number') {
                                            if (displayValue > 0 && c !== 'Exist' && c !== 'Clave') {
                                                content = displayValue.toLocaleString();
                                            }

                                            // Colores para valores de sucursales
                                            if (c !== 'Exist' && c !== 'Clave' && c !== 'Artículo') {
                                                const numVal = parseFloat(row.raw[c]);
                                                if (!isNaN(numVal)) {
                                                    if (numVal <= 0) cellClass += "bg-red-50 text-red-700 bg-opacity-70 border-l-[3px] border-l-red-500 font-bold ";
                                                    else if (numVal <= STOCK_BAJO) cellClass += "bg-amber-50 text-amber-700 bg-opacity-70 border-l-[3px] border-l-amber-500 font-bold ";
                                                    else cellClass += "bg-green-50 text-green-700 bg-opacity-70 border-l-[3px] border-l-green-500 font-bold ";
                                                }
                                            } else if (c === 'Exist') {
                                                const numVal = parseFloat(row.raw[c]);
                                                if (numVal <= 0) cellClass += "text-red-600 font-bold bg-slate-50 ";
                                                else if (numVal <= STOCK_BAJO) cellClass += "text-amber-600 font-bold bg-slate-50 ";
                                                else cellClass += "text-green-600 font-bold bg-slate-50 ";
                                            }
                                        }

                                        // 3. RENDERIZADO EXCLUSIVO PARA LA COLUMNA DE ROTACIÓN
                                        if (c === "Estado_Rotacion") {
                                            return (
                                                <td key={c} className="py-2.5 px-4 border-r border-slate-300/40 font-mono text-center">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                                        displayValue === "ROTACIÓN ACTIVA" ? "bg-green-100 text-green-800" :
                                                            displayValue === "NULA ROTACIÓN" ? "bg-amber-100 text-amber-800" :
                                                                displayValue === "COMPRA URGENTE" ? "bg-rose-100 text-rose-800" :
                                                                    "bg-slate-100 text-slate-600"
                                                    }`}>
                                                        {displayValue}
                                                    </span>
                                                </td>
                                            );
                                        }

                                        // RENDERIZADO NORMAL PARA EL RESTO DE COLUMNAS
                                        return (
                                            <td key={c} className={cellClass}>
                                                {content}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                    {currentPageData.length === 0 && (
                        <div className="p-8 text-center text-slate-500 font-mono">NO RECORDS FOUND</div>
                    )}
                </div>
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
          PAGE {page} OF {totalPages} • {filteredData.length.toLocaleString()} ITEMS
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

export default Inventario;

import React, { useMemo, useState } from "react";
import { Search, Columns, Save } from "lucide-react";
import { useAppContext } from "../../AppContext";
import { COLORS, STOCK_BAJO } from "../../lib/constants";
import { cn } from "../../lib/utils";
import { exportToExcel } from "../../lib/excel";

const Inventario: React.FC = () => {
  const { masterData, cols } = useAppContext();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;

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

  const getRowTag = (exist: number, index: number) => {
    if (exist <= 0) return "critico";
    if (exist <= STOCK_BAJO) return "bajo";
    return "bien";
  };

  const tagStyle = (tag: string) => {
    switch (tag) {
      case "critico":
        return { backgroundColor: COLORS.critico_bg, color: COLORS.critico_fg };
      case "bajo":
        return { backgroundColor: COLORS.bajo_bg, color: COLORS.bajo_fg };
      case "bien":
        return { backgroundColor: COLORS.bien_bg, color: COLORS.bien_fg };
      default:
        return {};
    }
  };

  const handleExport = () => {
    if (!masterData) return;
    const exportData = masterData.map(r => r.raw);
    exportToExcel(exportData, "Maestro_Farmacia_Exportado.xlsx");
  };

  if (!masterData) {
    return (
      <div className="h-full flex items-center justify-center text-[#888]">
        Por favor, carga un archivo maestro desde Inicio.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-900">📦 Inventario Maestro</h2>
        
        <div className="flex items-center gap-4 flex-1 justify-center max-w-xl">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={handleSearch}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded text-xs font-bold transition-colors uppercase">
            <Columns className="w-4 h-4" /> Columnas
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded text-xs font-bold transition-colors uppercase">
            <Save className="w-4 h-4" /> Guardar
          </button>
        </div>
      </header>

      <div className="flex items-center gap-6 px-6 py-3 bg-slate-50/80 text-[10px] border-b border-slate-200 font-medium uppercase tracking-wider text-slate-500">
        <span>Color de filas:</span>
        <span className="text-red-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Sin existencia / Crítico</span>
        <span className="text-amber-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Existencia baja</span>
        <span className="text-green-600 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Existencia normal</span>
      </div>

      <div className="flex-1 overflow-auto p-6 relative">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-w-max w-full inline-block">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead className="bg-slate-50/50 text-slate-500 uppercase text-[11px] tracking-wider">
              <tr>
                {cols.map((c) => (
                  <th key={c} className="py-3 px-4 font-bold border-b border-r border-slate-100 last:border-r-0 sticky top-0 bg-slate-50/95 backdrop-blur-sm shadow-sm">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentPageData.map((row, i) => {
                const tag = getRowTag(row.exist, i);
                return (
                  <tr key={`${row.clave}-${i}`} style={tagStyle(tag)}>
                    {cols.map((c) => {
                       // Format presentation based on value vs column
                       let displayValue = row.raw[c] ?? "";
                       if (typeof displayValue === 'number' && displayValue > 0 && c !== 'Exist' && c !== 'Clave') {
                           displayValue = displayValue.toLocaleString(); // Format normally without mangling the data
                       }
                      return (
                        <td key={c} className="py-3 px-4 border-b border-r border-slate-100 last:border-r-0 font-mono">
                          {displayValue}
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

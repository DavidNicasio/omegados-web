import React, { useState } from "react";
import { Plus, FolderUp, BarChart2 } from "lucide-react";
import { SUCURSALES } from "../../lib/constants";

const Paso1: React.FC = () => {
  const [files, setFiles] = useState<Array<{ name: string; suc: string }>>([]);

  const addFileMock = () => {
    // In a real Desktop Web App, this opens a file picker.
    // We mock the file selection logic visually.
    const newFile = `Ventas_Mes_${files.length + 1}.xlsx`;
    setFiles([...files, { name: newFile, suc: "Todas las sucursales" }]);
  };

  const removeFile = (i: number) => {
    const next = [...files];
    next.splice(i, 1);
    setFiles(next);
  };

  const updateSuc = (i: number, suc: string) => {
    const next = [...files];
    next[i].suc = suc;
    setFiles(next);
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <h2 className="text-xl font-bold flex items-center gap-3 mb-2 text-slate-900 border-b border-slate-200 pb-4">
        <BarChart2 className="w-5 h-5 text-blue-500" /> Paso 1: Ventas → Existencias
      </h2>
      <p className="text-slate-500 text-[13px] mb-8 max-w-3xl leading-relaxed mt-4">
        Carga los archivos de ventas. El sistema genera automáticamente un Excel
        de Existencias con el total vendido por producto y sucursal. Ese archivo
        también incluye el detalle mensual para el Paso 2.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-4xl overflow-hidden flex flex-col">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Archivos de Ventas</h3>
            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">INPUT SOURCE</span>
          </div>
          <p className="text-slate-500 text-xs mb-6">
            Para cada archivo indica si tiene TODAS las sucursales o solo
            una (selecciona cuál en el combo).
          </p>

          <div className="space-y-3 mb-6">
            {files.map((f, i) => (
              <div key={i} className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <select
                  value={f.suc}
                  onChange={(e) => updateSuc(i, e.target.value)}
                  className="bg-white border border-slate-300 rounded shadow-sm py-1.5 pl-3 pr-8 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 min-w-[200px]"
                >
                  <option value="Todas las sucursales">Todas las sucursales</option>
                  {SUCURSALES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="flex-1 flex items-center min-w-[150px]">
                  <span className="text-xs text-slate-700 font-mono flex items-center gap-2"><span className="text-green-500">📄</span> {f.name}</span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="w-7 h-7 flex items-center justify-center bg-white border border-red-200 hover:bg-red-50 text-red-600 rounded shadow-sm font-bold transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              onClick={addFileMock}
              className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 border-dashed text-xs font-bold py-3 px-6 rounded-lg shadow-sm transition-colors w-full"
            >
              <Plus className="w-4 h-4" /> AÑADIR ARCHIVO AL LOTE
            </button>
          </div>

          <div className="border-t border-slate-200 pt-6 mb-8">
            <h3 className="font-bold text-sm mb-2 text-slate-700">Guardar archivo de Existencias en:</h3>
            <p className="text-xs text-slate-500 mb-4">La versión web de escritorio descargará el archivo al completar.</p>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button className="px-6 py-2 bg-white border border-slate-300 rounded shadow-sm text-xs font-bold hover:bg-slate-50 text-slate-500 flex items-center gap-2 transition-colors opacity-50 cursor-not-allowed">
              <FolderUp className="w-4 h-4" /> SELECT DIR (DESKTOP)
            </button>
            <button
              onClick={() => alert('Esto procesaría las ventas y generaría "EXISTENCIAS.xlsx".')}
              className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded shadow hover:bg-slate-800 flex items-center gap-2 transition-colors"
            >
              <BarChart2 className="w-4 h-4" /> GENERAR EXISTENCIAS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paso1;

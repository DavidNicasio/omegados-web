import React from "react";
import { RefreshCcw, FolderUp } from "lucide-react";
import { SUCURSALES, MESES } from "../../lib/constants";

const Sync: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <h2 className="text-xl font-bold flex items-center gap-3 mb-2 text-slate-900 border-b border-slate-200 pb-4">
        <RefreshCcw className="w-5 h-5 text-blue-500" /> Sincronización Diaria
      </h2>
      <p className="text-slate-500 text-[13px] mb-8 max-w-3xl leading-relaxed mt-4">
        Actualiza existencias físicas o agrega ventas de un periodo al Maestro.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-5xl">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-start w-full">
          <div className="h-1.5 w-full bg-blue-500"></div>
          <div className="p-6 flex flex-col w-full h-full">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mb-2">Actualizar Existencias</h3>
            <p className="text-xs text-slate-500 mb-6 flex-1 min-h-[32px]">
              Sube el inventario de una tienda. Formato: <br/><span className="bg-slate-100 px-1 py-0.5 rounded font-mono mt-1 inline-block">Código | Artículo | Existencia</span>
            </p>

            <label className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Sucursal:</label>
            <select className="bg-white border border-slate-300 rounded shadow-sm py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 w-full mb-6">
              {SUCURSALES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button
               onClick={() => alert("Este botón actualizaría los datos del Maestro cargado actualmente.")}
               className="mt-6 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm text-xs font-bold rounded transition-colors w-full uppercase"
            >
              <FolderUp className="w-4 h-4" /> UPLOAD FILE
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-start w-full">
          <div className="h-1.5 w-full bg-green-500"></div>
          <div className="p-6 flex flex-col w-full h-full">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mb-2">Agregar Ventas del Período</h3>
            <p className="text-xs text-slate-500 mb-6 flex-1 min-h-[32px]">
              Sube un archivo de ventas para agregar una columna de periodo al Maestro.
            </p>

            <label className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Sucursal (GLOBAL si tiene todas):</label>
            <select className="bg-white border border-slate-300 rounded shadow-sm py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 w-full mb-4">
              <option value="GLOBAL">GLOBAL</option>
              {SUCURSALES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <label className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Rango de meses del reporte:</label>
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-200 mb-6 gap-2 w-full">
              <select className="bg-white border border-slate-300 rounded shadow-sm py-1.5 px-2 text-xs focus:outline-none w-[30%]">
                {MESES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 font-bold uppercase">To</span>
              <select defaultValue="DIC" className="bg-white border border-slate-300 rounded shadow-sm py-1.5 px-2 text-xs focus:outline-none w-[30%]">
                {MESES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="w-[1px] h-4 bg-slate-300"></div>
              <select defaultValue="2025" className="bg-white border border-slate-300 rounded shadow-sm py-1.5 px-2 text-xs focus:outline-none w-[25%] font-mono">
                {["2024", "2025", "2026", "2027"].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button
               onClick={() => alert("Este botón agregaría nuevas columnas de meses al Maestro cargado actualmente.")}
               className="mt-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white shadow hover:bg-slate-800 text-xs font-bold rounded transition-colors w-full uppercase"
            >
              <FolderUp className="w-4 h-4" /> UPLOAD SALES
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sync;

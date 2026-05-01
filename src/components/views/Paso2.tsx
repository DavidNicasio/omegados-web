import React from "react";
import { RefreshCw, FolderUp } from "lucide-react";

const Paso2: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <h2 className="text-xl font-bold flex items-center gap-3 mb-2 text-slate-900 border-b border-slate-200 pb-4">
        <RefreshCw className="w-5 h-5 text-blue-500" /> Paso 2: Existencias → Rotación
      </h2>
      <p className="text-slate-500 text-[13px] mb-8 max-w-3xl leading-relaxed mt-4">
        Carga el archivo de Existencias generado en el Paso 1. Ya contiene todos
        los datos necesarios — no necesitas subir ventas de nuevo.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-4xl overflow-hidden flex flex-col">
        <div className="p-6 space-y-6">
          <div>
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">📄 A. Archivo de Existencias:</h3>
             </div>
             <p className="text-xs text-slate-500 mb-4">El que generaste en el Paso 1 (EXISTENCIAS_*.xlsx)</p>
             <button className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 border-dashed px-6 py-3 rounded-lg text-xs font-bold transition-colors w-full max-w-sm">
               <FolderUp className="w-4 h-4" /> SELECT EXISTENCIAS FILE
             </button>
          </div>

          <div className="border-t border-slate-200 pt-6">
             <h3 className="font-bold text-sm mb-4 text-slate-700">⚙️ B. Configuración:</h3>
             <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>Producto estancado si no tuvo ventas en los últimos</span>
                <select className="bg-white border border-slate-300 rounded shadow-sm py-1.5 px-3 focus:outline-none focus:border-blue-500 text-slate-900 font-bold">
                   <option value="2">2</option>
                   <option value="3" defaultValue="3">3</option>
                   <option value="4">4</option>
                   <option value="5">5</option>
                   <option value="6">6</option>
                </select>
                <span>meses (3 es lo recomendado)</span>
             </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
             <h3 className="font-bold text-sm mb-4 text-slate-700">📁 C. ¿Dónde guardar el reporte?</h3>
             <button className="flex items-center justify-center gap-2 px-6 py-2 bg-white border border-slate-300 rounded shadow-sm text-xs font-bold transition-colors opacity-50 cursor-not-allowed w-full max-w-sm text-slate-500">
               <FolderUp className="w-4 h-4" /> SELECT DIRECTORY
             </button>
          </div>

          <div className="border-t border-slate-200 pt-6">
             <h3 className="font-bold text-sm mb-2 text-slate-700">🔁 D. Generar el reporte</h3>
             <p className="text-xs text-slate-500 mb-4">Cuando hayas completado los pasos A, B y C, presiona el botón.</p>
             <button
               onClick={() => alert('Esto procesará el excel y descargará ROTACION.xlsx')}
               className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded shadow hover:bg-slate-800 transition-colors w-full max-w-sm"
             >
               <RefreshCw className="w-4 h-4" /> BUILD ROTACIÓN
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paso2;

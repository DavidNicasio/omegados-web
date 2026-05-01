import React, { useRef, useState } from "react";
import { FolderUp, ArrowRight } from "lucide-react";
import { useAppContext } from "../../AppContext";
import { processMasterFile } from "../../lib/excel";

const Inicio: React.FC = () => {
  const { setActiveView, setMasterData, setAlerts, setCols, setFileName } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "error" } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage(null);

    try {
      const { data, alertas, rawColumns } = await processMasterFile(file);
      setMasterData(data);
      setAlerts(alertas);
      setFileName(file.name);
      
      const exclude = ["KEY", "ID", "UUID"];
      let visCols = rawColumns.filter(c => !exclude.includes(c.toUpperCase()));
      
      setCols(visCols);
      setMessage({ text: `✅ Maestro cargado: ${data.length} productos`, type: "ok" });
      setTimeout(() => setActiveView("inventario"), 800);
    } catch (err: any) {
      setMessage({ text: `❌ ${err}`, type: "error" });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
      <div className="max-w-4xl w-full flex flex-col items-center">
        <h2 className="text-3xl font-bold mb-2 text-slate-900">Bienvenido al sistema de Inventario</h2>
        <p className="text-slate-500 text-center mb-12 max-w-lg">
          El sistema trabaja en 2 pasos para generar el reporte de Rotación.
        </p>

        <div className="flex flex-col md:flex-row gap-6 mb-12 w-full justify-center items-stretch">
          <div className="bg-white rounded-xl p-6 flex-1 max-w-[240px] flex flex-col border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-blue-600 text-4xl font-bold mb-4 font-mono">01</span>
            <h3 className="font-bold text-sm mb-2 text-slate-800">Ventas → Existencias</h3>
            <p className="text-xs text-slate-500 flex-1">Carga archivos de ventas y genera Existencias por sucursal</p>
            <button
               onClick={() => setActiveView("paso1")}
               className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors w-full uppercase tracking-wider"
            >
              Ir →
            </button>
          </div>

          <div className="hidden md:flex items-center text-slate-300"><ArrowRight className="w-8 h-8"/></div>

          <div className="bg-white rounded-xl p-6 flex-1 max-w-[240px] flex flex-col border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-blue-600 text-4xl font-bold mb-4 font-mono">02</span>
            <h3 className="font-bold text-sm mb-2 text-slate-800">Existencias → Rotación</h3>
            <p className="text-xs text-slate-500 flex-1">Carga el archivo de Existencias y genera el reporte de Rotación</p>
            <button
               onClick={() => setActiveView("paso2")}
               className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors w-full uppercase tracking-wider"
            >
              Ir →
            </button>
          </div>

          <div className="hidden md:flex items-center text-slate-300"><ArrowRight className="w-8 h-8"/></div>

          <div className="bg-slate-900 rounded-xl p-6 flex-1 max-w-[240px] flex flex-col border border-slate-800 shadow-lg">
            <span className="text-blue-400 text-4xl font-bold mb-4 font-mono">03</span>
            <h3 className="font-bold text-sm mb-2 text-white">Cargar Maestro</h3>
            <p className="text-xs text-slate-400 flex-1">Abre el Excel de Rotación para el seguimiento diario</p>
            <button
               onClick={() => fileInputRef.current?.click()}
               className="mt-4 px-4 py-2 bg-blue-600/20 text-blue-400 text-xs font-bold rounded hover:bg-blue-600/30 flex items-center justify-center gap-2 transition-colors w-full uppercase tracking-wider border border-blue-500/20"
            >
              Cargar →
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-8 w-full max-w-xl text-center border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 flex items-center gap-2">
              <FolderUp className="w-4 h-4"/> Master File Loader
            </h3>
            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">READY FOR ANALYSIS</span>
          </div>
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-50 mb-4">
            <p className="text-xs text-slate-500 mb-4">
              Si ya tienes un archivo de Rotación generado, ábrelo aquí directamente
            </p>
            <input
              type="file"
              accept=".xlsx, .xls, .xlsm"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="px-6 py-2 bg-white border border-slate-300 rounded shadow-sm text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {loading ? "CARGANDO..." : "SELECT FILE"}
            </button>
          </div>
          
          {message && (
             <p className={`mt-2 text-[11px] font-mono tracking-wide ${message.type === 'ok' ? 'text-green-600 bg-green-50 px-3 py-1.5 rounded border border-green-200' : 'text-red-700 bg-red-50 px-3 py-1.5 rounded border border-red-200'}`}>
                {message.text}
             </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inicio;

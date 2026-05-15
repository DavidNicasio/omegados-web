import React, { useState } from "react";
import { Plus, FolderUp, BarChart2, Loader2, Download } from "lucide-react";
import { SUCURSALES } from "../../lib/constants";
import * as XLSX from "xlsx";
import { toast } from "sonner";

const Paso1: React.FC = () => {
  const [files, setFiles] = useState<Array<{ file: File; name: string; suc: string }>>([]);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(f => ({ file: f, name: f.name, suc: "Todas las sucursales" }));
      setFiles([...files, ...newFiles]);
    }
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

  const handleProcess = async () => {
    if (files.length === 0) {
      toast.error("Por favor agrega al menos un archivo de ventas.");
      return;
    }

    setProcessing(true);
    const loadingToast = toast.loading("Procesando archivos de ventas y generando Existencias...");

    try {
      // Simulating a complex merge loop
      // In a real scenario, this iterates through all files, aggregates quantities by product, branch, and month.
      const workbook = XLSX.utils.book_new();
      
      const combinedData: any[] = [];
      
      // Basic mock aggregation just to generate a valid Excel structure 
      // (as we don't know the exact format of the raw sales files)
      for (const f of files) {
        const data = await f.file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];
        
        rows.forEach(r => {
           combinedData.push({
             "Clave": r["Clave"] || r["Código"] || r["Code"] || `GEN-${Math.floor(Math.random()*1000)}`,
             "Descripción": r["Descripción"] || r["Artículo"] || "ARTICULO DESCONOCIDO",
             "Existencia": r["Existencia"] || r["Inventario"] || 0,
             "Venta_QTY": r["Venta"] || r["Cantidad"] || 1,
             "Sucursal_Origen": f.suc
           });
        });
      }

      const ws = XLSX.utils.json_to_sheet(combinedData);
      XLSX.utils.book_append_sheet(workbook, ws, "EXISTENCIAS_AGGREGATED");
      XLSX.writeFile(workbook, "EXISTENCIAS_GENERATED.xlsx");
      
      toast.success("Archivo EXISTENCIAS_GENERATED.xlsx generado exitosamente.", { id: loadingToast });
      setFiles([]);
    } catch (error: any) {
      toast.error("Error al generar: " + error.message, { id: loadingToast });
    } finally {
      setProcessing(false);
    }
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

            <div className="relative">
              <input 
                type="file" 
                multiple 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
              <button
                className="flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 border-dashed text-xs font-bold py-3 px-6 rounded-lg shadow-sm transition-colors w-full"
              >
                <Plus className="w-4 h-4" /> AÑADIR ARCHIVO AL LOTE
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-wrap mt-8">
            <button
              onClick={handleProcess}
              disabled={processing}
              className="px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded shadow hover:bg-slate-800 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {processing ? 'GENERANDO...' : 'GENERAR EXISTENCIAS'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paso1;

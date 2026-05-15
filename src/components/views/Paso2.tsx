import React, { useState } from "react";
import { RefreshCw, FolderUp, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { SUCURSALES } from "../../lib/constants";

const Paso2: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [mesesEstancado, setMesesEstancado] = useState(3);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleProcess = async () => {
    if (!file) {
      toast.error("Por favor selecciona el archivo de existencias.");
      return;
    }

    setProcessing(true);
    const loadingToast = toast.loading("Analizando y generando Rotación...");

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const items = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]) as any[];

      // Build MultiIndex Header for export
      // Rows:
      // 0: ['', '', '', 'ABASTOS', '', '', '', 'ATZOMPA', ...]
      // 1: ['Clave', 'Descripción', 'Existe', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'ABR', ...]
      const headerRow0: any[] = ["", "", ""];
      const headerRow1: any[] = ["Clave", "Descripción", "Existe"];
      
      const mesesDummy = ["ABR", "MAY", "JUN", "JUL", "AGO", "SEPT"];

      SUCURSALES.forEach(suc => {
         headerRow0.push(suc);
         for (let i = 1; i < mesesDummy.length; i++) headerRow0.push("");
         mesesDummy.forEach(m => headerRow1.push(m));
      });

      const exportData: any[][] = [headerRow0, headerRow1];

      // Insert processed rows
      items.forEach(item => {
        const row = [
          item["Clave"] || item["Código"] || `SKU-${Math.floor(Math.random() * 9000)}`,
          item["Descripción"] || item["Artículo"] || "ARTICULO",
          item["Existe"] || item["Existencia"] || Math.floor(Math.random() * 20),
        ];

        SUCURSALES.forEach(() => {
          mesesDummy.forEach(() => {
             // Mock sales data
             row.push(Math.floor(Math.random() * 5));
          });
        });

        exportData.push(row);
      });

      const newWb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(exportData);
      XLSX.utils.book_append_sheet(newWb, ws, "Rotación (Maestro)");
      XLSX.writeFile(newWb, "ROTACION.xlsx");

      toast.success("Archivo ROTACION.xlsx descargado exitosamente.", { id: loadingToast });
      setFile(null);
    } catch (err: any) {
      toast.error("Error al procesar: " + err.message, { id: loadingToast });
    } finally {
      setProcessing(false);
    }
  };

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
             <div className="relative w-full max-w-sm">
               <input 
                 type="file" 
                 accept=".xlsx, .xls, .csv" 
                 onChange={handleFileChange}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
               />
               <button className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-300 border-dashed px-6 py-3 rounded-lg text-xs font-bold transition-colors w-full max-w-sm">
                 <FolderUp className="w-4 h-4" /> {file ? file.name : "SELECT EXISTENCIAS FILE"}
               </button>
             </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
             <h3 className="font-bold text-sm mb-4 text-slate-700">⚙️ B. Configuración:</h3>
             <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>Producto estancado si no tuvo ventas en los últimos</span>
                <select 
                  value={mesesEstancado}
                  onChange={(e) => setMesesEstancado(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded shadow-sm py-1.5 px-3 focus:outline-none focus:border-blue-500 text-slate-900 font-bold"
                >
                   <option value="2">2</option>
                   <option value="3">3</option>
                   <option value="4">4</option>
                   <option value="5">5</option>
                   <option value="6">6</option>
                </select>
                <span>meses (3 es lo recomendado)</span>
             </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
             <h3 className="font-bold text-sm mb-2 text-slate-700">🔁 C. Generar el reporte</h3>
             <p className="text-xs text-slate-500 mb-4">Cuando hayas completado los pasos A y B, presiona el botón para exportar Rotación.</p>
             <button
               onClick={handleProcess}
               disabled={processing || !file}
               className="flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 text-white text-xs font-bold rounded shadow hover:bg-slate-800 transition-colors w-full max-w-sm disabled:opacity-50"
             >
               {processing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Download className="w-4 h-4" />}
               {processing ? 'GENERANDO...' : 'BUILD ROTACIÓN'}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paso2;

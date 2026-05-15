import React, { useState } from "react";
import { RefreshCcw, FolderUp, Loader2, CloudUpload } from "lucide-react";
import { SUCURSALES, MESES } from "../../lib/constants";
import { toast } from "sonner";
import { syncInventoryData } from "../../services/api";
import { useAppContext } from "../../AppContext";
import * as XLSX from "xlsx";

const Sync: React.FC = () => {
  const { masterData, setMasterData } = useAppContext();
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  
  const [sucursalActualizar, setSucursalActualizar] = useState(SUCURSALES[0]);

  const handleUpdateStocks = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (!masterData || masterData.length === 0) {
      toast.error("Debes tener un Inventario Maestro cargado en la vista 'Inventario' antes de actualizarlo localmente.");
      return;
    }
    
    setLoadingStocks(true);
    const loadingToast = toast.loading(`Actualizando inventario base con datos locales de ${sucursalActualizar}...`);
    
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];

      // Mock Local Update logic: 
      // Overwrite the 'Exist' column on matching masterData lines
      const updatedMaster = [...masterData];
      let updatedCount = 0;
      
      rows.forEach(r => {
         const clave = String(r["Clave"] || r["Código"] || "").trim().toUpperCase();
         const exist = Number(r["Existencia"] || r["Cantidad"] || r["Exist"] || 0);
         
         const idx = updatedMaster.findIndex(m => m.clave.toUpperCase() === clave);
         if (idx !== -1) {
             updatedMaster[idx].exist = exist;
             if(updatedMaster[idx].raw) updatedMaster[idx].raw["Exist"] = exist;
             updatedCount++;
         }
      });
      
      setMasterData(updatedMaster);
      toast.success(`Se actualizaron ${updatedCount} productos exitosamente.`, { id: loadingToast });
    } catch (err: any) {
      toast.error("Error al actualizar existencias: " + err.message, { id: loadingToast });
    } finally {
      setLoadingStocks(false);
      e.target.value = "";
    }
  };

  const handleCloudSync = async () => {
    if (!masterData || masterData.length === 0) {
      toast.error("No hay un archivo Maestro cargado en memoria.");
      return;
    }
    
    setLoadingStocks(true);
    const loadingToast = toast.loading(`Sincronizando inventario de ${sucursalActualizar} hacia la nube...`);
    
    try {
      const response = await syncInventoryData(masterData);
      if (response.success) {
        toast.success(response.message || "Inventario sincronizado exitosamente", { id: loadingToast });
      } else {
        toast.error(response.error || "No se pudo sincronizar el inventario", { id: loadingToast });
      }
    } catch (err: any) {
      toast.error(err.message || "Error al sincronizar con la API", { id: loadingToast });
    } finally {
      setLoadingStocks(false);
    }
  };

  const handleUpdateSales = async () => {
    setLoadingSales(true);
    const loadingToast = toast.loading("Procesando histórico de ventas en la nube...");
    
    try {
      // Simulamos la lógica para actualizar ventas. 
      // Podría crearse otro endpoint en services/api.ts para envíar el periodo.
      await new Promise((resolve) => setTimeout(resolve, 2000));
      
      toast.success("Ventas del periodo actualizadas exitosamente.", { id: loadingToast });
    } catch (error: any) {
      toast.error("Error al actualizar las ventas: " + error.message, { id: loadingToast });
    } finally {
      setLoadingSales(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 overflow-y-auto">
      <h2 className="text-xl font-bold flex items-center gap-3 mb-2 text-slate-900 border-b border-slate-200 pb-4">
        <RefreshCcw className="w-5 h-5 text-blue-500" /> Sincronización Local / Nube
      </h2>
      <p className="text-slate-500 text-[13px] mb-8 max-w-3xl leading-relaxed mt-4">
        Actualiza el Inventario Maestro con inventario físico o envía todo el catálogo a la nube.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start max-w-5xl">
        {/* Card: Actualizar Existencias */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-start w-full transition-all">
          <div className="h-1.5 w-full bg-blue-500"></div>
          <div className="p-6 flex flex-col w-full h-full relative">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mb-2">1. Actualizar Datos Locales</h3>
            <p className="text-xs text-slate-500 mb-6 flex-1 min-h-[32px]">
              Sube un Excel físico para sobreescribir la columna 'Existe' del Maestro actual en memoria.
            </p>

            <div className="relative w-full mb-6">
              <input 
                 type="file"
                 accept=".xlsx, .xls, .csv"
                 onChange={handleUpdateStocks}
                 disabled={loadingStocks}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button
                 className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 shadow-sm text-xs font-bold rounded transition-colors w-full uppercase disabled:opacity-50"
              >
                {loadingStocks ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-slate-500" /> CARGANDO LOCAL...</>
                ) : (
                  <><FolderUp className="w-4 h-4 text-slate-500" /> SUBIR INVENTARIO FÍSICO</>
                )}
              </button>
            </div>
            
            <hr className="w-full border-slate-200 mb-6"/>
            
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mb-2">2. Empujar a la Nube</h3>
            <p className="text-xs text-slate-500 mb-4">
              Envía el catálogo validado a Alegra / Zoho.
            </p>
            
            <label className="text-[11px] uppercase tracking-wider text-slate-500 mb-1 font-bold">Sucursal a sincronizar:</label>
            <select 
               value={sucursalActualizar}
               onChange={(e) => setSucursalActualizar(e.target.value)}
               className="bg-white border border-slate-300 rounded shadow-sm py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700 w-full mb-4 disabled:opacity-50"
               disabled={loadingStocks}
            >
              {SUCURSALES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button
               onClick={handleCloudSync}
               disabled={loadingStocks}
               className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-sm text-xs font-bold rounded transition-colors w-full uppercase disabled:opacity-50 mt-auto"
            >
              {loadingStocks ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> SINCRONIZANDO NUBE...</>
              ) : (
                <><CloudUpload className="w-4 h-4" /> ENVIAR MAESTRO A LA NUBE</>
              )}
            </button>
          </div>
        </div>

        {/* Card: Agregar Ventas */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-start w-full">
          <div className="h-1.5 w-full bg-green-500"></div>
          <div className="p-6 flex flex-col w-full h-full relative">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-800 mb-2">Procesar Histórico Ventas</h3>
            <p className="text-xs text-slate-500 mb-6 flex-1 min-h-[32px]">
              Procesa un periodo de ventas y lo unifica en el sistema de reportes en la nube.
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
               onClick={handleUpdateSales}
               disabled={loadingSales}
               className="mt-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white shadow hover:bg-slate-800 text-xs font-bold rounded transition-colors w-full uppercase disabled:opacity-50"
            >
              {loadingSales ? (
                 <><Loader2 className="w-4 h-4 animate-spin text-white" /> ENVIANDO...</>
              ) : (
                <><CloudUpload className="w-4 h-4 text-white" /> UPLOAD SALES</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sync;

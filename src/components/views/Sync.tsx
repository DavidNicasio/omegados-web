import React, { useState, useRef } from "react";
import { FolderUp, Loader2, DatabaseZap } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "../../AppContext";
import * as XLSX from "xlsx";
import { MESES } from "../../lib/constants";

const Sync: React.FC = () => {
    const { masterData, setMasterData } = useAppContext();
    const [loadingStocks, setLoadingStocks] = useState(false);
    const [loadingSales, setLoadingSales] = useState(false);

    const stockInputRef = useRef<HTMLInputElement>(null);
    const salesInputRef = useRef<HTMLInputElement>(null);

    // --- 1. ACTUALIZAR EXISTENCIAS ---
    const handleUpdateStocks = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        if (!masterData || masterData.length === 0) {
            toast.error("Debes tener un Inventario Maestro cargado primero.");
            if (stockInputRef.current) stockInputRef.current.value = "";
            return;
        }

        setLoadingStocks(true);
        const loadingToast = toast.loading("Analizando archivo de existencias físicas...");

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet) as any[];

            const updatedMaster = [...masterData];
            let updatedCount = 0;

            rows.forEach(row => {
                const clave = String(row["Clave"] || row["CLAVE"] || row["Código"] || "").trim().toUpperCase();
                // Busca variaciones del nombre de la columna para 'Existencia'
                const nuevaExistencia = Number(row["Existencia"] || row["General"] || row["Exist"] || row["EXISTENCIA"] || 0);

                const idx = updatedMaster.findIndex(m => String(m.clave).trim().toUpperCase() === clave);
                if (idx !== -1 && nuevaExistencia !== undefined && !isNaN(nuevaExistencia)) {
                    updatedMaster[idx].exist = nuevaExistencia;
                    updatedCount++;
                }
            });

            setMasterData(updatedMaster);
            toast.success(`Existencias actualizadas: ${updatedCount} productos modificados.`, { id: loadingToast });
        } catch (err: any) {
            toast.error("Error al actualizar existencias: " + err.message, { id: loadingToast });
        } finally {
            setLoadingStocks(false);
            if (stockInputRef.current) stockInputRef.current.value = "";
        }
    };

    // --- 2. ACUMULAR VENTAS ---
    const handleUpdateSales = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];

        if (!masterData || masterData.length === 0) {
            toast.error("Debes tener un Inventario Maestro cargado primero.");
            if (salesInputRef.current) salesInputRef.current.value = "";
            return;
        }

        setLoadingSales(true);
        const loadingToast = toast.loading("Procesando y sumando nuevo historial de ventas...");

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet) as any[];

            const updatedMaster = [...masterData];
            let updatedCount = 0;

            rows.forEach(row => {
                const clave = String(row["Clave"] || row["CLAVE"] || row["Código"] || "").trim().toUpperCase();

                const idx = updatedMaster.findIndex(m => String(m.clave).trim().toUpperCase() === clave);
                if (idx !== -1) {
                    let ventasNuevas = 0;

                    // Sumar ventas de los meses que vengan en el archivo nuevo
                    MESES.forEach(mes => {
                        if (row[mes] !== undefined) {
                            const valorMes = Number(row[mes]) || 0;
                            // Si no existe el objeto meses, lo creamos
                            if (!updatedMaster[idx].meses) updatedMaster[idx].meses = {};

                            // Sumamos lo que ya había más lo nuevo
                            updatedMaster[idx].meses[mes] = (updatedMaster[idx].meses[mes] || 0) + valorMes;
                            ventasNuevas += valorMes;
                        }
                    });

                    // Actualizamos el gran total si hubo ventas nuevas
                    if (ventasNuevas > 0) {
                        updatedCount++;
                    }
                }
            });

            setMasterData(updatedMaster);
            toast.success(`Ventas fusionadas en ${updatedCount} productos correctamente.`, { id: loadingToast });
        } catch (err: any) {
            toast.error("Error al procesar ventas: " + err.message, { id: loadingToast });
        } finally {
            setLoadingSales(false);
            if (salesInputRef.current) salesInputRef.current.value = "";
        }
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-slate-50">
            <h2 className="text-2xl font-bold flex items-center gap-3 mb-2 text-slate-900 border-b border-slate-200 pb-4">
                <DatabaseZap className="w-6 h-6 text-blue-500" /> Sincronización e Ingreso de Datos
            </h2>
            <p className="text-slate-500 text-[14px] mb-8 max-w-3xl leading-relaxed mt-4">
                Actualiza el Inventario Maestro añadiendo nuevos archivos. El sistema <b>no borrará</b> lo que ya tienes; es lo suficientemente inteligente para encontrar los productos por su CLAVE y actualizar sus existencias o sumar sus nuevas ventas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-5xl">
                {/* Card: Actualizar Existencias */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-start w-full transition-all">
                    <div className="h-2 w-full bg-blue-500"></div>
                    <div className="p-8 flex flex-col w-full h-full relative">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">1. Carga de Existencias</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-1">
                            Sube el reporte más reciente de almacén (ej. reporte diario o semanal). Solo modificará la columna de inventario físico disponible.
                        </p>

                        <div className="relative w-full">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleUpdateStocks}
                                disabled={loadingStocks}
                                ref={stockInputRef}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <button
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-blue-300 hover:bg-blue-50 text-blue-600 font-bold rounded-lg transition-colors w-full uppercase disabled:opacity-50"
                            >
                                {loadingStocks ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> PROCESANDO STOCK...</>
                                ) : (
                                    <><FolderUp className="w-5 h-5" /> ARRASTRAR NUEVO STOCK</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Card: Agregar Ventas */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col items-start w-full">
                    <div className="h-2 w-full bg-green-500"></div>
                    <div className="p-8 flex flex-col w-full h-full relative">
                        <h3 className="text-lg font-bold text-slate-800 mb-2">2. Carga de Nuevas Ventas</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-1">
                            Sube el reporte de ventas del mes o periodo reciente. El sistema sumará estas unidades vendidas al historial que ya existe para evaluar la rotación.
                        </p>

                        <div className="relative w-full">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleUpdateSales}
                                disabled={loadingSales}
                                ref={salesInputRef}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <button
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 border-2 border-slate-900 text-white hover:bg-slate-800 shadow font-bold rounded-lg transition-colors w-full uppercase disabled:opacity-50"
                            >
                                {loadingSales ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> FUSIONANDO VENTAS...</>
                                ) : (
                                    <><FolderUp className="w-5 h-5" /> ARRASTRAR NUEVAS VENTAS</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sync;
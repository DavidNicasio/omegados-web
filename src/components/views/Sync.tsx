import React, { useState, useRef } from "react";
import { FolderUp, Loader2, DatabaseZap } from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "../../AppContext";
import * as XLSX from "xlsx";
import { MESES, SUCURSALES } from "../../lib/constants";

const Sync: React.FC = () => {
    const { masterData, setMasterData } = useAppContext();
    const [loadingStocks, setLoadingStocks] = useState(false);
    const [loadingSales, setLoadingSales] = useState(false);

    // Estados para los selectores de sucursal
    const [sucursalStock, setSucursalStock] = useState("TODAS");
    const [sucursalSales, setSucursalSales] = useState("TODAS");

    const stockInputRef = useRef<HTMLInputElement>(null);
    const salesInputRef = useRef<HTMLInputElement>(null);

    // Normalizador de sucursales
    const normSucursal = (nombre: string) => {
        let limpio = nombre.toLowerCase().replace("sucursal", "").trim();
        if (limpio === "santarosa") return "SANTA ROSA";
        if (limpio === "torre medica" || limpio === "torremedica") return "TORRE MEDICA";
        return limpio.toUpperCase();
    };

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
        const loadingToast = toast.loading(`Actualizando existencias para: ${sucursalStock}...`);

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet) as any[];

            // Diccionario rápido para cruzar datos por CLAVE
            const newDataDict: Record<string, any> = {};
            rows.forEach(row => {
                const claveKey = Object.keys(row).find(k => k.toLowerCase().includes("clave") || k.toLowerCase().includes("cod"));
                if (claveKey) {
                    const clave = String(row[claveKey]).trim().toUpperCase();
                    if (clave && clave !== "000XXX") newDataDict[clave] = row;
                }
            });

            let updatedCount = 0;

            const updatedMaster = masterData.map(productoOriginal => {
                const clave = String(productoOriginal.clave).trim().toUpperCase();
                const nuevoDato = newDataDict[clave];

                if (nuevoDato) {
                    // COPIA PROFUNDA: Esto asegura que el 22 pase a 33 en la tabla visualmente
                    const productoActualizado = {
                        ...productoOriginal,
                        sucursales: { ...productoOriginal.sucursales },
                        raw: { ...productoOriginal.raw }
                    };

                    if (sucursalStock !== "TODAS") {
                        // SI ES UNA SUCURSAL ESPECÍFICA (Ej. Abastos)
                        // Busca la columna de la sucursal, o las genéricas de total
                        const colVal = nuevoDato[sucursalStock] || nuevoDato["Existencia"] || nuevoDato["General"] || nuevoDato["Exist"] || nuevoDato["EXISTENCIA"] || nuevoDato["TOTAL"] || 0;
                        const nuevaExistencia = Number(colVal);

                        if (!isNaN(nuevaExistencia)) {
                            productoActualizado.sucursales[sucursalStock] = nuevaExistencia;
                            productoActualizado.raw[sucursalStock] = nuevaExistencia;
                            updatedCount++;
                        }
                    } else {
                        // SI ES GLOBAL (Todas las sucursales en un solo archivo)
                        Object.keys(nuevoDato).forEach((k) => {
                            const sucNorm = normSucursal(k);
                            if (SUCURSALES.map(s => s.toUpperCase()).includes(sucNorm)) {
                                const val = Number(nuevoDato[k]) || 0;
                                productoActualizado.sucursales[sucNorm] = val;
                                productoActualizado.raw[sucNorm] = val;
                                updatedCount++;
                            }
                        });
                    }

                    // Recalcular el gran total global sumando todas las sucursales actualizadas
                    const nuevoTotalGlobal = Object.values(productoActualizado.sucursales).reduce((a: number, b: any) => a + (Number(b) || 0), 0);                    productoActualizado.exist = nuevoTotalGlobal;
                    productoActualizado.raw["Exist"] = nuevoTotalGlobal;

                    return productoActualizado;
                }
                return productoOriginal; // Si no hay cambios, retorna intacto
            });

            setMasterData(updatedMaster);
            toast.success(`Existencias actualizadas correctamente.`, { id: loadingToast });
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
        const loadingToast = toast.loading(`Procesando historial de ventas para: ${sucursalSales}...`);

        try {
            const data = await file.arrayBuffer();
            const wb = XLSX.read(data, { type: "array" });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet) as any[];

            const newDataDict: Record<string, any> = {};
            rows.forEach(row => {
                const claveKey = Object.keys(row).find(k => k.toLowerCase().includes("clave") || k.toLowerCase().includes("cod"));
                if (claveKey) {
                    const clave = String(row[claveKey]).trim().toUpperCase();
                    if (clave && clave !== "000XXX") newDataDict[clave] = row;
                }
            });

            let updatedCount = 0;

            const updatedMaster = masterData.map(productoOriginal => {
                const clave = String(productoOriginal.clave).trim().toUpperCase();
                const nuevoDato = newDataDict[clave];

                if (nuevoDato) {
                    let ventasNuevas = 0;

                    MESES.forEach(mes => {
                        if (nuevoDato[mes] !== undefined) {
                            ventasNuevas += Number(nuevoDato[mes]) || 0;
                        }
                    });

                    // Si no trae meses, intentamos buscar una columna TOTAL
                    if (ventasNuevas === 0 && (nuevoDato["TOTAL"] || nuevoDato["Total"])) {
                        ventasNuevas = Number(nuevoDato["TOTAL"] || nuevoDato["Total"]) || 0;
                    }

                    if (ventasNuevas > 0) {
                        updatedCount++;
                        const ventasActuales = Number(productoOriginal.raw["Ventas_Global"] || 0);

                        return {
                            ...productoOriginal,
                            raw: {
                                ...productoOriginal.raw,
                                Ventas_Global: ventasActuales + ventasNuevas
                            }
                        };
                    }
                }
                return productoOriginal;
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
                        <p className="text-sm text-slate-500 mb-4 flex-1">
                            Sube el reporte más reciente de almacén (ej. reporte diario o semanal). Solo modificará la columna de inventario físico disponible.
                        </p>

                        <div className="w-full mb-6">
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                                ¿A qué sucursal pertenece este archivo?
                            </label>
                            <select
                                value={sucursalStock}
                                onChange={(e) => setSucursalStock(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-700"
                            >
                                <option value="TODAS">Global (Todas las Sucursales)</option>
                                <optgroup label="Sucursal Específica">
                                    {SUCURSALES.map((s) => (
                                        <option key={s} value={s.toUpperCase()}>{s.toUpperCase()}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

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
                        <p className="text-sm text-slate-500 mb-4 flex-1">
                            Sube el reporte de ventas del mes o periodo reciente. El sistema sumará estas unidades vendidas al historial que ya existe para evaluar la rotación.
                        </p>

                        <div className="w-full mb-6">
                            <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                                ¿A qué sucursal pertenece este reporte?
                            </label>
                            <select
                                value={sucursalSales}
                                onChange={(e) => setSucursalSales(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-slate-700"
                            >
                                <option value="TODAS">Global (Todas las Sucursales)</option>
                                <optgroup label="Sucursal Específica">
                                    {SUCURSALES.map((s) => (
                                        <option key={s} value={s.toUpperCase()}>{s.toUpperCase()}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

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
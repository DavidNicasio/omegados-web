import React, { useState } from "react";
import { FolderUp, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { procesarRotacionCruzada } from "../../lib/excel";
import { useAppContext } from "../../AppContext";

const Paso2: React.FC = () => {
    const { setMasterData, setAlerts, setCols, setActiveView } = useAppContext();

    const [fileVentas, setFileVentas] = useState<File | null>(null);
    const [fileExistencias, setFileExistencias] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);

    const handleProcess = async () => {
        if (!fileVentas || !fileExistencias) {
            toast.error("Faltan archivos. Por favor carga Ventas y Existencias.");
            return;
        }

        setProcessing(true);
        const loadingToast = toast.loading("Aplicando reglas de Rotación (Buscando estancados)...");

        try {
            // Llamamos a la nueva función exportada en excel.ts
            const { data, alertas, rawColumns } = await procesarRotacionCruzada(fileVentas, fileExistencias);

            setMasterData(data);
            setAlerts(alertas);
            setCols(rawColumns);

            toast.success(`Análisis completado. Se generaron ${alertas.length} traspasos y compras.`, { id: loadingToast });

            // Enviamos al usuario a ver los resultados en la tabla de Alertas
            setActiveView("alertas");
        } catch (err: any) {
            toast.error("Error al procesar: " + err.message, { id: loadingToast });
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-[#f8fafc]">
            <h2 className="text-xl font-bold flex items-center gap-3 mb-2 text-slate-900 border-b border-slate-200 pb-4">
                <Play className="w-5 h-5 text-blue-500" /> Creador de Rotación (Reglas de Cliente)
            </h2>
            <p className="text-slate-500 text-[13px] mb-8 max-w-3xl leading-relaxed mt-4">
                Sube las existencias consolidadas y las ventas. El sistema identificará
                la "Nula Rotación" por sucursal y sugerirá traspasos automáticamente a quien sí lo vende.
            </p>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm w-full max-w-4xl overflow-hidden flex flex-col">
                <div className="p-6 space-y-6">

                    <div className="flex gap-6 flex-wrap">
                        {/* Input de Existencias */}
                        <div className="flex-1 min-w-[300px]">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">📦 Archivo de Existencias</h3>
                            <p className="text-xs text-slate-500 mb-4">Ej: EXIST CONSOLIDADA.xlsx</p>
                            <div className="relative w-full">
                                <input
                                    type="file" accept=".xlsx, .xls, .csv"
                                    onChange={(e) => setFileExistencias(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <button className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-300 border-dashed px-6 py-3 rounded-lg text-xs font-bold transition-colors w-full">
                                    <FolderUp className="w-4 h-4" /> {fileExistencias ? fileExistencias.name : "SELECCIONAR EXISTENCIAS"}
                                </button>
                            </div>
                        </div>

                        {/* Input de Ventas */}
                        <div className="flex-1 min-w-[300px]">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-2">📈 Archivo de Ventas</h3>
                            <p className="text-xs text-slate-500 mb-4">Ej: VTA26.xlsx</p>
                            <div className="relative w-full">
                                <input
                                    type="file" accept=".xlsx, .xls, .csv"
                                    onChange={(e) => setFileVentas(e.target.files?.[0] || null)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <button className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-300 border-dashed px-6 py-3 rounded-lg text-xs font-bold transition-colors w-full">
                                    <FolderUp className="w-4 h-4" /> {fileVentas ? fileVentas.name : "SELECCIONAR VENTAS"}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-200 pt-6 mt-6">
                        <button
                            onClick={handleProcess}
                            disabled={processing || !fileExistencias || !fileVentas}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white text-xs font-bold rounded shadow hover:bg-blue-700 transition-colors w-full max-w-sm disabled:opacity-50 mx-auto tracking-widest"
                        >
                            {processing ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Play className="w-4 h-4" />}
                            {processing ? 'CRUZANDO DATOS...' : 'EJECUTAR ROTACIÓN'}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Paso2;
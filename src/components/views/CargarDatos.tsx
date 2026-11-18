import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Play, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
    inspeccionarExistencias,
    inspeccionarVentas,
    procesarRotacionCruzada,
    revisarCruce,
    type ResumenExistencias,
    type ResumenVentas,
} from "../../lib/excel";
import { MESES } from "../../lib/constants";
import { formatearFechaLarga, huellaArchivo, nombreSucursal } from "../../lib/utils";
import ActualizarSinEmpezar from "./ActualizarSinEmpezar";
import { useAppContext } from "../../AppContext";

type Revision<T> =
    | { estado: "leyendo" }
    | { estado: "error"; mensaje: string }
    | { estado: "listo"; resumen: T };

const num = (n: number) => n.toLocaleString("es-MX");
const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;

const textoMeses = (meses: string[]): string => {
    if (meses.length === 0) return "Ninguno";
    const idx = meses.map((m) => MESES.indexOf(m));
    const seguidos = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
    if (meses.length > 2 && seguidos) return `${meses[0]} a ${meses[meses.length - 1]} (${meses.length} meses)`;
    return meses.join(", ");
};

const listaSucursales = (s: string[]) => s.map(nombreSucursal).join(", ");

// ---------------------------------------------------------------------------
// Tarjeta para elegir un archivo
// ---------------------------------------------------------------------------
interface TarjetaArchivoProps {
    numero: number;
    titulo: string;
    descripcion: string;
    ejemplo: string;
    file: File | null;
    onChange: (f: File | null) => void;
    deshabilitado: boolean;
}

const TarjetaArchivo: React.FC<TarjetaArchivoProps> = ({
    numero,
    titulo,
    descripcion,
    ejemplo,
    file,
    onChange,
    deshabilitado,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const abrir = () => inputRef.current?.click();

    return (
        <section
            aria-labelledby={`tarjeta-${numero}`}
            className="flex-1 min-w-[300px] bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4"
        >
            <div className="flex items-start gap-3">
                <span
                    className="w-8 h-8 shrink-0 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center"
                    aria-hidden="true"
                >
                    {numero}
                </span>
                <div>
                    <h3 id={`tarjeta-${numero}`} className="text-base font-semibold text-slate-900">
                        {titulo}
                    </h3>
                    <p className="text-sm text-[#475569] mt-0.5">{descripcion}</p>
                    <p className="text-xs text-[#475569] mt-0.5">Por ejemplo: {ejemplo}</p>
                </div>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label={`Elegir archivo de ${titulo.toLowerCase()}`}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                    onChange(e.target.files?.[0] || null);
                    e.target.value = "";
                }}
            />

            {file ? (
                <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-[#DCFCE7] px-3 py-2">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-[#16A34A]" aria-hidden="true" />
                    <span className="flex-1 min-w-0 text-sm font-medium text-[#166534] truncate" title={file.name}>
                        {file.name}
                    </span>
                    <button
                        type="button"
                        onClick={abrir}
                        disabled={deshabilitado}
                        aria-label={`Cambiar el archivo de ${titulo.toLowerCase()}`}
                        className="min-h-[44px] px-4 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Cambiar
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={abrir}
                    disabled={deshabilitado}
                    className="min-h-[44px] flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-400 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                    <Upload className="w-4 h-4" aria-hidden="true" /> Elegir archivo
                </button>
            )}
        </section>
    );
};

// ---------------------------------------------------------------------------
// Bloques del panel de revisión
// ---------------------------------------------------------------------------
const Dato: React.FC<{ etiqueta: string; children: React.ReactNode }> = ({ etiqueta, children }) => (
    <div className="flex flex-wrap gap-x-2 text-sm">
        <dt className="text-[#475569]">{etiqueta}:</dt>
        <dd className="font-medium text-slate-900">{children}</dd>
    </div>
);

const Mensajes: React.FC<{ errores: string[]; avisos: string[] }> = ({ errores, avisos }) => (
    <>
        {errores.map((m) => (
            <div
                key={m}
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#991B1B]"
            >
                <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#DC2626]" aria-hidden="true" />
                <span>{m}</span>
            </div>
        ))}
        {avisos.map((m) => (
            <div
                key={m}
                className="flex items-start gap-2 rounded-lg bg-[#FEF3C7] px-3 py-2 text-sm text-[#92400E]"
            >
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
                <span>{m}</span>
            </div>
        ))}
    </>
);

const Leyendo: React.FC<{ texto: string }> = ({ texto }) => (
    <p className="flex items-center gap-2 text-sm text-[#475569]" role="status">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {texto}
    </p>
);

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------
const CargarDatos: React.FC = () => {
    const { masterData, loadInfo, setMasterData, setAlerts, setCols, setLoadInfo, setHuellasVentas, setActiveView } =
        useAppContext();

    const [fileExistencias, setFileExistencias] = useState<File | null>(null);
    const [fileVentas, setFileVentas] = useState<File | null>(null);
    const [revExistencias, setRevExistencias] = useState<Revision<ResumenExistencias> | null>(null);
    const [revVentas, setRevVentas] = useState<Revision<ResumenVentas> | null>(null);
    const [confirmando, setConfirmando] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Para ignorar resultados viejos si el usuario cambia de archivo mientras se lee
    const lecturaExistencias = useRef(0);
    const lecturaVentas = useRef(0);

    const elegirExistencias = async (file: File | null) => {
        setConfirmando(false);
        setFileExistencias(file);
        const id = ++lecturaExistencias.current;
        if (!file) return setRevExistencias(null);
        setRevExistencias({ estado: "leyendo" });
        try {
            const resumen = await inspeccionarExistencias(file);
            if (id === lecturaExistencias.current) setRevExistencias({ estado: "listo", resumen });
        } catch {
            if (id === lecturaExistencias.current) {
                setRevExistencias({ estado: "error", mensaje: "No pudimos leer este archivo. Revisa que sea un Excel válido." });
            }
        }
    };

    const elegirVentas = async (file: File | null) => {
        setConfirmando(false);
        setFileVentas(file);
        const id = ++lecturaVentas.current;
        if (!file) return setRevVentas(null);
        setRevVentas({ estado: "leyendo" });
        try {
            const resumen = await inspeccionarVentas(file);
            if (id === lecturaVentas.current) setRevVentas({ estado: "listo", resumen });
        } catch {
            if (id === lecturaVentas.current) {
                setRevVentas({ estado: "error", mensaje: "No pudimos leer este archivo. Revisa que sea un Excel válido." });
            }
        }
    };

    const cruce = useMemo(() => {
        if (revExistencias?.estado === "listo" && revVentas?.estado === "listo") {
            return revisarCruce(revExistencias.resumen, revVentas.resumen);
        }
        return { errores: [] as string[], avisos: [] as string[] };
    }, [revExistencias, revVentas]);

    const archivoValido = <T extends { errores: string[] }>(r: Revision<T> | null) =>
        r?.estado === "listo" && r.resumen.errores.length === 0;
    const puedeCalcular =
        !!fileExistencias &&
        !!fileVentas &&
        archivoValido(revExistencias) &&
        archivoValido(revVentas) &&
        cruce.errores.length === 0 &&
        !processing;

    const hayDatos = !!masterData && masterData.length > 0;

    const calcular = async () => {
        if (!fileVentas || !fileExistencias) return;
        setConfirmando(false);
        setProcessing(true);
        const cargando = toast.loading("Calculando rotación y alertas…");
        try {
            await new Promise((r) => setTimeout(r, 50)); // deja pintar el estado "Calculando"
            const { data, alertas, rawColumns } = await procesarRotacionCruzada(fileVentas, fileExistencias);
            const traspasos = alertas.filter((a) => a.tipo === "TRASPASO").length;
            const compras = alertas.filter((a) => a.tipo === "COMPRA").length;

            setMasterData(data);
            setAlerts(alertas);
            setCols(rawColumns);
            setLoadInfo({ existenciasName: fileExistencias.name, ventasName: fileVentas.name, loadedAt: Date.now() });
            // Al reemplazar los datos, la lista de archivos de ventas ya sumados empieza de nuevo
            setHuellasVentas([{ huella: huellaArchivo(fileVentas), nombre: fileVentas.name, fecha: Date.now() }]);

            toast.success(
                `Listo: ${plural(traspasos, "traspaso", "traspasos")} y ${plural(compras, "compra", "compras")}`,
                { id: cargando }
            );
            setActiveView("alertas");
        } catch (err: any) {
            toast.error(`No se pudo calcular: ${err?.message || err}`, { id: cargando });
        } finally {
            setProcessing(false);
        }
    };

    const alPresionarCalcular = () => (hayDatos ? setConfirmando(true) : calcular());

    const hayRevision = !!revExistencias || !!revVentas;

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto bg-[#F6F8FB]">
            <h2 className="text-xl font-bold text-slate-900">Cargar datos</h2>
            <p className="text-sm text-[#475569] mt-1 mb-6 max-w-3xl">
                Sube tus dos archivos de Excel. Los revisamos y calculamos qué productos mover entre sucursales y cuáles comprar.
            </p>

            <div className="flex gap-5 flex-wrap max-w-5xl">
                <TarjetaArchivo
                    numero={1}
                    titulo="Existencias"
                    descripcion="El inventario actual de cada sucursal."
                    ejemplo="EXISTENCIA.xlsx"
                    file={fileExistencias}
                    onChange={elegirExistencias}
                    deshabilitado={processing}
                />
                <TarjetaArchivo
                    numero={2}
                    titulo="Ventas"
                    descripcion="Lo que se vendió por producto, sucursal y mes."
                    ejemplo="VTA 2026.xlsx"
                    file={fileVentas}
                    onChange={elegirVentas}
                    deshabilitado={processing}
                />
            </div>

            {hayRevision && (
                <section
                    aria-labelledby="titulo-revision"
                    className="mt-6 max-w-5xl bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-5"
                >
                    <h3 id="titulo-revision" className="text-base font-semibold text-slate-900">
                        Revisamos tus archivos antes de calcular
                    </h3>

                    <div className="grid gap-6 md:grid-cols-2">
                        {revExistencias && (
                            <div className="flex flex-col gap-2">
                                <h4 className="text-sm font-semibold text-slate-900">Existencias</h4>
                                {revExistencias.estado === "leyendo" && <Leyendo texto="Leyendo el archivo…" />}
                                {revExistencias.estado === "error" && (
                                    <Mensajes errores={[revExistencias.mensaje]} avisos={[]} />
                                )}
                                {revExistencias.estado === "listo" && (
                                    <>
                                        {revExistencias.resumen.errores.length === 0 && (
                                            <dl className="flex flex-col gap-1">
                                                <Dato etiqueta="Productos">
                                                    {num(revExistencias.resumen.filasConProducto)}
                                                </Dato>
                                                <Dato etiqueta="Sucursales encontradas">
                                                    {revExistencias.resumen.sucursales.length} de 16
                                                    <span className="block text-xs font-normal text-[#475569]">
                                                        {listaSucursales(revExistencias.resumen.sucursales)}
                                                    </span>
                                                </Dato>
                                                <Dato etiqueta="Filas de relleno ignoradas">
                                                    {num(revExistencias.resumen.filasRelleno)}
                                                </Dato>
                                            </dl>
                                        )}
                                        <Mensajes
                                            errores={revExistencias.resumen.errores}
                                            avisos={revExistencias.resumen.avisos}
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        {revVentas && (
                            <div className="flex flex-col gap-2">
                                <h4 className="text-sm font-semibold text-slate-900">Ventas</h4>
                                {revVentas.estado === "leyendo" && (
                                    <Leyendo texto="Leyendo el archivo, puede tardar unos segundos…" />
                                )}
                                {revVentas.estado === "error" && <Mensajes errores={[revVentas.mensaje]} avisos={[]} />}
                                {revVentas.estado === "listo" && (
                                    <>
                                        {revVentas.resumen.errores.length === 0 && (
                                            <dl className="flex flex-col gap-1">
                                                <Dato etiqueta="Filas">{num(revVentas.resumen.filas)}</Dato>
                                                <Dato etiqueta="Productos distintos">{num(revVentas.resumen.productos)}</Dato>
                                                <Dato etiqueta="Meses encontrados">{textoMeses(revVentas.resumen.meses)}</Dato>
                                                <Dato etiqueta="Sucursales con ventas">
                                                    {revVentas.resumen.sucursales.length} de 16
                                                    <span className="block text-xs font-normal text-[#475569]">
                                                        {listaSucursales(revVentas.resumen.sucursales)}
                                                    </span>
                                                </Dato>
                                            </dl>
                                        )}
                                        <Mensajes errores={revVentas.resumen.errores} avisos={revVentas.resumen.avisos} />
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {(cruce.errores.length > 0 || cruce.avisos.length > 0) && (
                        <div className="flex flex-col gap-2">
                            <Mensajes errores={cruce.errores} avisos={cruce.avisos} />
                        </div>
                    )}
                </section>
            )}

            <div className="mt-6 max-w-5xl">
                {confirmando ? (
                    <div
                        role="alertdialog"
                        aria-labelledby="titulo-confirmar"
                        className="rounded-xl border border-[#F59E0B] bg-[#FEF3C7] p-5 flex flex-col gap-4"
                    >
                        <p id="titulo-confirmar" className="text-sm text-[#92400E] font-medium">
                            Ya tienes datos cargados el {loadInfo ? formatearFechaLarga(loadInfo.loadedAt) : "día anterior"}.
                            Si sigues, los reemplazamos y recalculamos las alertas.
                        </p>
                        <div className="flex gap-3 flex-wrap">
                            <button
                                type="button"
                                autoFocus
                                onClick={() => setConfirmando(false)}
                                className="min-h-[44px] px-5 rounded-lg border border-slate-400 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={calcular}
                                className="min-h-[44px] px-5 rounded-lg bg-[#2563EB] text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                            >
                                Reemplazar y calcular
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-start gap-2">
                        <button
                            type="button"
                            onClick={alPresionarCalcular}
                            disabled={!puedeCalcular}
                            aria-describedby="ayuda-calcular"
                            className="min-h-[44px] flex items-center justify-center gap-2 px-6 rounded-lg bg-[#2563EB] text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Play className="w-4 h-4" aria-hidden="true" />
                            )}
                            {processing ? "Calculando…" : "Calcular rotación y alertas"}
                        </button>
                        {!puedeCalcular && !processing && (
                            <p id="ayuda-calcular" className="text-sm text-[#475569]">
                                {!fileExistencias || !fileVentas
                                    ? "Faltan archivos: sube existencias y ventas para continuar."
                                    : revExistencias?.estado === "leyendo" || revVentas?.estado === "leyendo"
                                      ? "Estamos revisando tus archivos…"
                                      : "Corrige los errores en rojo para continuar."}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {hayDatos && <ActualizarSinEmpezar />}
        </div>
    );
};

export default CargarDatos;

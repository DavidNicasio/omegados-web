import React, { useId, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
    actualizarExistencias,
    descargarClavesNoEncontradas,
    sumarVentas,
    type ResultadoActualizacion,
} from "../../lib/excel";
import { SUCURSALES } from "../../lib/constants";
import { formatearFechaLarga, huellaArchivo, nombreSucursal } from "../../lib/utils";
import { useAppContext } from "../../AppContext";

type Tipo = "existencias" | "ventas";

interface Resultado {
    archivo: string;
    actualizados: number;
    noEncontradas: string[];
    traspasos: number;
    compras: number;
}

const num = (n: number) => n.toLocaleString("es-MX");
const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;
const MAX_CLAVES_VISIBLES = 100;

// ---------------------------------------------------------------------------
// Tarjeta de una actualización (existencias o ventas)
// ---------------------------------------------------------------------------
interface TarjetaProps {
    titulo: string;
    descripcion: string;
    etiquetaSelector: string;
    sucursal: string;
    onSucursal: (s: string) => void;
    cargando: boolean;
    bloqueado: boolean;
    textoBoton: string;
    textoResultado: (n: number) => string;
    onArchivo: (f: File) => void;
    resultado: Resultado | null;
    error: string | null;
    children?: React.ReactNode;
}

const TarjetaActualizacion: React.FC<TarjetaProps> = ({
    titulo,
    descripcion,
    etiquetaSelector,
    sucursal,
    onSucursal,
    cargando,
    bloqueado,
    textoBoton,
    textoResultado,
    onArchivo,
    resultado,
    error,
    children,
}) => {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);
    const [verClaves, setVerClaves] = useState(false);

    return (
        <section aria-labelledby={`${id}-titulo`} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
            <div>
                <h4 id={`${id}-titulo`} className="text-base font-semibold text-slate-900">
                    {titulo}
                </h4>
                <p className="text-sm text-[#475569] mt-0.5">{descripcion}</p>
            </div>

            <div className="flex flex-col gap-1">
                <label htmlFor={`${id}-sucursal`} className="text-sm font-medium text-slate-800">
                    {etiquetaSelector}
                </label>
                <select
                    id={`${id}-sucursal`}
                    value={sucursal}
                    onChange={(e) => onSucursal(e.target.value)}
                    disabled={cargando}
                    className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                    <option value="TODAS">Todas las sucursales</option>
                    {SUCURSALES.map((s) => (
                        <option key={s} value={s}>
                            {nombreSucursal(s)}
                        </option>
                    ))}
                </select>
            </div>

            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                aria-label={`Elegir archivo para ${titulo.toLowerCase()}`}
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) {
                        setVerClaves(false);
                        onArchivo(f);
                    }
                }}
            />
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={cargando || bloqueado}
                className="min-h-[44px] flex items-center justify-center gap-2 rounded-lg border border-[#2563EB] bg-white px-4 text-sm font-semibold text-[#2563EB] hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {cargando ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                    <RefreshCcw className="w-4 h-4" aria-hidden="true" />
                )}
                {cargando ? "Actualizando…" : textoBoton}
            </button>

            {children}

            {error && (
                <div role="alert" className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] px-3 py-2 text-sm text-[#991B1B]">
                    <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#DC2626]" aria-hidden="true" />
                    <span>{error}</span>
                </div>
            )}

            {resultado && (
                <div role="status" className="rounded-lg bg-[#DCFCE7] px-3 py-3 text-sm text-[#166534] flex flex-col gap-2">
                    <p className="flex items-start gap-2 font-semibold">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#16A34A]" aria-hidden="true" />
                        <span>
                            {textoResultado(resultado.actualizados)} · {plural(resultado.noEncontradas.length, "clave no encontrada", "claves no encontradas")}
                        </span>
                    </p>
                    <p>
                        Archivo: {resultado.archivo}. Recalculamos las alertas: {plural(resultado.traspasos, "traspaso", "traspasos")} y{" "}
                        {plural(resultado.compras, "compra", "compras")}.
                    </p>
                    {resultado.noEncontradas.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => setVerClaves((v) => !v)}
                                    aria-expanded={verClaves}
                                    className="min-h-[44px] px-4 rounded-lg border border-[#16A34A] bg-white text-sm font-semibold text-[#166534] hover:bg-green-50 transition-colors"
                                >
                                    {verClaves ? "Ocultar claves" : "Ver claves"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => descargarClavesNoEncontradas(resultado.noEncontradas, "Claves_no_encontradas.xlsx")}
                                    className="min-h-[44px] px-4 flex items-center gap-2 rounded-lg border border-[#16A34A] bg-white text-sm font-semibold text-[#166534] hover:bg-green-50 transition-colors"
                                >
                                    <Download className="w-4 h-4" aria-hidden="true" /> Descargar claves
                                </button>
                            </div>
                            {verClaves && (
                                <div className="max-h-40 overflow-y-auto rounded-lg bg-white border border-green-200 p-3 text-sm text-slate-800">
                                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                                        {resultado.noEncontradas.slice(0, MAX_CLAVES_VISIBLES).map((c) => (
                                            <li key={c}>{c}</li>
                                        ))}
                                    </ul>
                                    {resultado.noEncontradas.length > MAX_CLAVES_VISIBLES && (
                                        <p className="mt-2 text-xs text-[#475569]">
                                            Y {num(resultado.noEncontradas.length - MAX_CLAVES_VISIBLES)} más. Descarga las claves para verlas todas.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

// ---------------------------------------------------------------------------
// Sección completa
// ---------------------------------------------------------------------------
const ActualizarSinEmpezar: React.FC = () => {
    const { masterData, setMasterData, setAlerts, huellasVentas, setHuellasVentas } = useAppContext();

    const [sucExistencias, setSucExistencias] = useState("TODAS");
    const [sucVentas, setSucVentas] = useState("TODAS");
    const [procesando, setProcesando] = useState<Tipo | null>(null);
    const [resultados, setResultados] = useState<Partial<Record<Tipo, Resultado>>>({});
    const [errores, setErrores] = useState<Partial<Record<Tipo, string>>>({});
    const [duplicado, setDuplicado] = useState<{ file: File; fecha: number } | null>(null);

    if (!masterData || masterData.length === 0) return null;

    // Datos guardados con una versión anterior de la app no traen las ventas por sucursal
    const datosAntiguos = !masterData[0].ventasPorSucursal;

    const ponerResultado = (tipo: Tipo, archivo: string, r: ResultadoActualizacion) => {
        setMasterData(r.data);
        setAlerts(r.alertas);
        const traspasos = r.alertas.filter((a) => a.tipo === "TRASPASO").length;
        const compras = r.alertas.filter((a) => a.tipo === "COMPRA").length;
        setResultados((prev) => ({
            ...prev,
            [tipo]: { archivo, actualizados: r.actualizados, noEncontradas: r.noEncontradas, traspasos, compras },
        }));
        toast.success(`Listo: ${plural(traspasos, "traspaso", "traspasos")} y ${plural(compras, "compra", "compras")}`);
    };

    const ejecutar = async (tipo: Tipo, file: File) => {
        setErrores((prev) => ({ ...prev, [tipo]: undefined }));
        setResultados((prev) => ({ ...prev, [tipo]: undefined }));
        setProcesando(tipo);
        try {
            await new Promise((r) => setTimeout(r, 50)); // deja pintar el estado "Actualizando"
            if (tipo === "existencias") {
                ponerResultado(tipo, file.name, await actualizarExistencias(file, masterData, sucExistencias));
            } else {
                ponerResultado(tipo, file.name, await sumarVentas(file, masterData, sucVentas));
                const huella = huellaArchivo(file);
                setHuellasVentas([
                    ...huellasVentas.filter((h) => h.huella !== huella),
                    { huella, nombre: file.name, fecha: Date.now() },
                ]);
            }
        } catch (err: any) {
            setErrores((prev) => ({ ...prev, [tipo]: err?.message || "No pudimos leer este archivo." }));
        } finally {
            setProcesando(null);
        }
    };

    const alElegirVentas = (file: File) => {
        const previo = huellasVentas.find((h) => h.huella === huellaArchivo(file));
        if (previo) setDuplicado({ file, fecha: previo.fecha });
        else ejecutar("ventas", file);
    };

    return (
        <section aria-labelledby="titulo-actualizar" className="mt-10 max-w-5xl">
            <h3 id="titulo-actualizar" className="text-lg font-semibold text-slate-900">
                Actualizar sin empezar de cero
            </h3>
            <p className="text-sm text-[#475569] mt-1 mb-4 max-w-3xl">
                Pon tus datos al día sin borrar lo que ya tienes. Después de cada actualización recalculamos los estados de rotación y las alertas.
            </p>

            {datosAntiguos && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[#FEF3C7] px-3 py-2 text-sm text-[#92400E]">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
                    <span>
                        Tus datos se guardaron con una versión anterior de la app y no se pueden actualizar. Vuelve a cargar tus dos archivos
                        arriba para poder usar esta sección.
                    </span>
                </div>
            )}

            <div className="grid gap-5 md:grid-cols-2">
                <TarjetaActualizacion
                    titulo="Existencias nuevas"
                    descripcion="Cambia la existencia de los productos que ya tienes. No toca las ventas."
                    etiquetaSelector="¿De qué sucursal es el archivo?"
                    sucursal={sucExistencias}
                    onSucursal={setSucExistencias}
                    cargando={procesando === "existencias"}
                    bloqueado={datosAntiguos || procesando !== null || !!duplicado}
                    textoBoton="Elegir archivo y actualizar"
                    textoResultado={(n) => plural(n, "producto actualizado", "productos actualizados")}
                    onArchivo={(f) => ejecutar("existencias", f)}
                    resultado={resultados.existencias || null}
                    error={errores.existencias || null}
                />

                <TarjetaActualizacion
                    titulo="Ventas nuevas"
                    descripcion="Suma las ventas del archivo a las que ya tienes, sucursal por sucursal."
                    etiquetaSelector="¿De qué sucursal es el archivo?"
                    sucursal={sucVentas}
                    onSucursal={setSucVentas}
                    cargando={procesando === "ventas"}
                    bloqueado={datosAntiguos || procesando !== null || !!duplicado}
                    textoBoton="Elegir archivo y sumar"
                    textoResultado={(n) => plural(n, "producto con ventas sumadas", "productos con ventas sumadas")}
                    onArchivo={alElegirVentas}
                    resultado={resultados.ventas || null}
                    error={errores.ventas || null}
                >
                    {duplicado && (
                        <div
                            role="alertdialog"
                            aria-labelledby="titulo-duplicado"
                            className="rounded-lg border border-[#F59E0B] bg-[#FEF3C7] p-4 flex flex-col gap-3"
                        >
                            <p id="titulo-duplicado" className="text-sm font-medium text-[#92400E]">
                                Este archivo ya se cargó el {formatearFechaLarga(duplicado.fecha)}. ¿Sumarlo de todos modos?
                            </p>
                            <div className="flex gap-3 flex-wrap">
                                <button
                                    type="button"
                                    autoFocus
                                    onClick={() => setDuplicado(null)}
                                    className="min-h-[44px] px-5 rounded-lg border border-slate-400 bg-white text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const f = duplicado.file;
                                        setDuplicado(null);
                                        ejecutar("ventas", f);
                                    }}
                                    className="min-h-[44px] px-5 rounded-lg bg-[#2563EB] text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                                >
                                    Sumar de todos modos
                                </button>
                            </div>
                        </div>
                    )}
                </TarjetaActualizacion>
            </div>
        </section>
    );
};

export default ActualizarSinEmpezar;

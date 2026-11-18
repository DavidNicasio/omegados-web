import React, { useId, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    CloudUpload,
    Download,
    Inbox,
    Loader2,
    Search,
} from "lucide-react";
import { toast } from "sonner";
import { useAppContext } from "../../AppContext";
import { exportToExcel, type Alert } from "../../lib/excel";
import { SUCURSALES } from "../../lib/constants";
import {
    agruparTraspasos,
    contarPendientes,
    sumarPiezas,
    type GrupoTraspaso,
} from "../../lib/alertas";
import { cn, nombreSucursal } from "../../lib/utils";
import { MODO_PRUEBA, createTransferOrders } from "../../services/api";

type Pestana = "traspasos" | "compras";

const COMPRAS_POR_PAGINA = 25;
const MAX_CHIPS_SE_VENDE_EN = 3;

const num = (n: number) => n.toLocaleString("es-MX");
const plural = (n: number, uno: string, varios: string) => `${num(n)} ${n === 1 ? uno : varios}`;

// ---------------------------------------------------------------------------
// Piezas pequeñas
// ---------------------------------------------------------------------------
const Chip: React.FC<{ className?: string; children: React.ReactNode; title?: string }> = ({ className, children, title }) => (
    <span
        title={title}
        className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", className)}
    >
        {children}
    </span>
);

const ChipSucursal: React.FC<{ nombre: string; destacado?: boolean }> = ({ nombre, destacado }) => (
    <Chip className={destacado ? "bg-blue-50 text-[#1D4ED8] border border-blue-200" : "bg-slate-100 text-slate-700 border border-slate-200"}>
        {nombreSucursal(nombre)}
    </Chip>
);

const ChipEstado: React.FC<{ hecho: boolean; textoHecho: string }> = ({ hecho, textoHecho }) =>
    hecho ? (
        <Chip className="bg-[#DCFCE7] text-[#166534]">{textoHecho}</Chip>
    ) : (
        <Chip className="bg-[#FEF3C7] text-[#92400E]">Pendiente</Chip>
    );

// ---------------------------------------------------------------------------
// Tarjeta de un traspaso (una ruta origen -> destino)
// ---------------------------------------------------------------------------
interface TarjetaTraspasoProps {
    grupo: GrupoTraspaso;
    hecho: boolean;
    abierto: boolean;
    onAbrir: () => void;
    onMarcar: () => void;
}

const TarjetaTraspaso: React.FC<TarjetaTraspasoProps> = ({ grupo, hecho, abierto, onAbrir, onMarcar }) => {
    const id = useId();
    return (
        <article
            aria-labelledby={`${id}-ruta`}
            className={cn("bg-white rounded-xl border shadow-sm", hecho ? "border-green-200" : "border-slate-200")}
        >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                <div className="flex items-center gap-2 flex-wrap min-w-[220px]">
                    <h3 id={`${id}-ruta`} className="flex items-center gap-2 flex-wrap">
                        <span className="sr-only">De {nombreSucursal(grupo.origen)} a {nombreSucursal(grupo.destino)}</span>
                        <span aria-hidden="true" className="flex items-center gap-2 flex-wrap">
                            <ChipSucursal nombre={grupo.origen} />
                            <ArrowRight className="w-4 h-4 text-slate-500" />
                            <ChipSucursal nombre={grupo.destino} destacado />
                        </span>
                    </h3>
                    <ChipEstado hecho={hecho} textoHecho="Hecho" />
                </div>

                <p className="text-sm text-[#475569] flex-1 min-w-[140px]">
                    {plural(grupo.items.length, "producto", "productos")} · {plural(grupo.piezas, "pza", "pzas")}
                </p>

                <div className="flex gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={onAbrir}
                        aria-expanded={abierto}
                        aria-controls={`${id}-tabla`}
                        className="min-h-[44px] px-4 flex items-center gap-2 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                        {abierto ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
                        {abierto ? "Ocultar productos" : "Ver productos"}
                    </button>
                    <button
                        type="button"
                        onClick={onMarcar}
                        className={cn(
                            "min-h-[44px] px-4 flex items-center gap-2 rounded-lg text-sm font-semibold transition-colors",
                            hecho
                                ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                : "bg-[#2563EB] text-white hover:bg-blue-700"
                        )}
                    >
                        {!hecho && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                        {hecho ? "Deshacer" : "Marcar como hecho"}
                    </button>
                </div>
            </div>

            {abierto && (
                <div id={`${id}-tabla`} className="border-t border-slate-200 max-h-96 overflow-auto">
                    <table className="w-full text-sm">
                        <caption className="sr-only">
                            Productos a traspasar de {nombreSucursal(grupo.origen)} a {nombreSucursal(grupo.destino)}
                        </caption>
                        <thead className="sticky top-0 bg-slate-50 text-left text-[#475569]">
                            <tr>
                                <th scope="col" className="px-4 py-2 font-semibold">Producto</th>
                                <th scope="col" className="px-4 py-2 font-semibold">Clave</th>
                                <th scope="col" className="px-4 py-2 font-semibold text-right">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grupo.items.map((a) => (
                                <tr key={a.clave} className="border-t border-slate-100">
                                    <td className="px-4 py-2 text-slate-900">{a.producto || "Sin nombre"}</td>
                                    <td className="px-4 py-2 text-[#475569]">{a.clave}</td>
                                    <td className="px-4 py-2 text-right font-semibold text-slate-900">
                                        {typeof a.cantidad === "number" ? num(a.cantidad) : a.cantidad}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </article>
    );
};

// ---------------------------------------------------------------------------
// Fila de una compra
// ---------------------------------------------------------------------------
const FilaCompra: React.FC<{ alerta: Alert; pedida: boolean; onMarcar: () => void }> = ({ alerta, pedida, onMarcar }) => {
    const sucursales = alerta.sucursales && alerta.sucursales.length > 0 ? alerta.sucursales : [];
    const visibles = sucursales.slice(0, MAX_CHIPS_SE_VENDE_EN);
    const resto = sucursales.length - visibles.length;

    return (
        <li className={cn("bg-white rounded-xl border shadow-sm p-4 flex flex-wrap items-center gap-x-6 gap-y-3", pedida ? "border-green-200" : "border-slate-200")}>
            <div className="flex-1 min-w-[220px]">
                <p className="text-sm font-semibold text-slate-900">{alerta.producto || "Sin nombre"}</p>
                <p className="text-xs text-[#475569] mt-0.5">Clave: {alerta.clave}</p>
            </div>

            <div className="min-w-[200px] flex-1">
                <p className="text-xs text-[#475569] mb-1">Se vende en</p>
                <div className="flex flex-wrap gap-1.5">
                    {visibles.map((s) => (
                        <ChipSucursal key={s} nombre={s} />
                    ))}
                    {resto > 0 && (
                        <Chip className="bg-slate-100 text-slate-700 border border-slate-200">
                            y {plural(resto, "sucursal más", "sucursales más")}
                        </Chip>
                    )}
                    {sucursales.length === 0 && <span className="text-sm text-[#475569]">Sin dato</span>}
                </div>
            </div>

            <div className="min-w-[140px]">
                <p className="text-xs text-[#475569] mb-1">Cantidad sugerida</p>
                {alerta.cantidad === "REVISAR" ? (
                    <div className="flex flex-col gap-1 max-w-[220px]">
                        <Chip className="bg-[#FEF3C7] text-[#92400E] self-start">Revisar</Chip>
                        <p className="text-xs text-[#92400E]">No hay ventas para calcularla. Decide cuánto pedir.</p>
                    </div>
                ) : (
                    <p className="text-base font-bold text-slate-900">{num(alerta.cantidad)}</p>
                )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <ChipEstado hecho={pedida} textoHecho="Pedido" />
                <button
                    type="button"
                    onClick={onMarcar}
                    className={cn(
                        "min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors",
                        pedida
                            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            : "bg-[#2563EB] text-white hover:bg-blue-700"
                    )}
                >
                    {pedida ? "Deshacer" : "Marcar como pedido"}
                </button>
            </div>
        </li>
    );
};

// ---------------------------------------------------------------------------
// Pantalla
// ---------------------------------------------------------------------------
const Alertas: React.FC = () => {
    const { alerts, masterData, setActiveView, alertasHechas, marcarAlerta, alertasPestana: pestana, setAlertasPestana: setPestana } =
        useAppContext();

    const [busqueda, setBusqueda] = useState("");
    const [sucursal, setSucursal] = useState("TODAS");
    const [soloPendientes, setSoloPendientes] = useState(false);
    const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
    const [pagina, setPagina] = useState(1);
    const [enviando, setEnviando] = useState(false);

    const grupos = useMemo(() => agruparTraspasos(alerts), [alerts]);
    const compras = useMemo(() => alerts.filter((a) => a.tipo === "COMPRA"), [alerts]);
    const pendientes = useMemo(() => contarPendientes(alerts, alertasHechas), [alerts, alertasHechas]);

    // Resultado de búsqueda + sucursal (sin el filtro "solo pendientes", para que el avance tenga sentido)
    const gruposFiltrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const out: GrupoTraspaso[] = [];
        grupos.forEach((g) => {
            if (sucursal !== "TODAS" && g.origen !== sucursal && g.destino !== sucursal) return;
            if (!q) return void out.push(g);
            const items = g.items.filter((a) => a.clave.toLowerCase().includes(q) || (a.producto || "").toLowerCase().includes(q));
            if (items.length > 0) out.push({ ...g, items, piezas: sumarPiezas(items) });
        });
        return out;
    }, [grupos, busqueda, sucursal]);

    const comprasFiltradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return compras.filter((a) => {
            if (sucursal !== "TODAS" && !(a.sucursales?.includes(sucursal) || a.destino.includes(sucursal))) return false;
            if (q && !(a.clave.toLowerCase().includes(q) || (a.producto || "").toLowerCase().includes(q))) return false;
            return true;
        });
    }, [compras, busqueda, sucursal]);

    const esTraspasos = pestana === "traspasos";
    const hechosTraspasos = gruposFiltrados.filter((g) => alertasHechas.traspasos[g.id]).length;
    const hechasCompras = comprasFiltradas.filter((a) => alertasHechas.compras[a.clave]).length;
    const totalVista = esTraspasos ? gruposFiltrados.length : comprasFiltradas.length;
    const hechosVista = esTraspasos ? hechosTraspasos : hechasCompras;

    const gruposVisibles = soloPendientes ? gruposFiltrados.filter((g) => !alertasHechas.traspasos[g.id]) : gruposFiltrados;
    const comprasVisibles = soloPendientes ? comprasFiltradas.filter((a) => !alertasHechas.compras[a.clave]) : comprasFiltradas;

    const totalPaginas = Math.max(1, Math.ceil(comprasVisibles.length / COMPRAS_POR_PAGINA));
    const paginaActual = Math.min(pagina, totalPaginas);
    const comprasPagina = comprasVisibles.slice((paginaActual - 1) * COMPRAS_POR_PAGINA, paginaActual * COMPRAS_POR_PAGINA);

    const hayFiltros = busqueda.trim() !== "" || sucursal !== "TODAS" || soloPendientes;
    const limpiarFiltros = () => {
        setBusqueda("");
        setSucursal("TODAS");
        setSoloPendientes(false);
        setPagina(1);
    };

    const cantidadVisible = esTraspasos ? gruposVisibles.reduce((t, g) => t + g.items.length, 0) : comprasVisibles.length;

    // --- Exportar lo que se ve (pestaña + filtros) ---
    const exportar = () => {
        if (cantidadVisible === 0) {
            toast.error("No hay nada que exportar con estos filtros.");
            return;
        }
        const filas = esTraspasos
            ? gruposVisibles.flatMap((g) =>
                  g.items.map((a) => ({
                      "Tipo de Alerta": a.tipo,
                      "Clave": a.clave,
                      "Producto": a.producto,
                      "Origen": a.origen,
                      "Destino / Sucursal": a.destino,
                      "Cantidad": a.cantidad,
                      "Estado": alertasHechas.traspasos[g.id] ? "Hecho" : "Pendiente",
                  }))
              )
            : comprasVisibles.map((a) => ({
                  "Tipo de Alerta": a.tipo,
                  "Clave": a.clave,
                  "Producto": a.producto,
                  "Origen": a.origen,
                  "Destino / Sucursal": a.destino,
                  "Cantidad": a.cantidad,
                  "Estado": alertasHechas.compras[a.clave] ? "Pedido" : "Pendiente",
              }));
        const suc = sucursal !== "TODAS" ? nombreSucursal(sucursal).replace(/\s+/g, "_") : "Global";
        exportToExcel(filas, `${esTraspasos ? "Traspasos" : "Compras"}_${suc}.xlsx`);
        toast.success(`Excel generado con ${plural(filas.length, "fila", "filas")}.`);
    };

    // --- Enviar traspasos pendientes ---
    const enviarTraspasos = async () => {
        const rutasPendientes = grupos.filter((g) => !alertasHechas.traspasos[g.id]);
        const pendientesParaEnviar = rutasPendientes.flatMap((g) => g.items);
        if (pendientesParaEnviar.length === 0) {
            toast.error("No hay traspasos pendientes para enviar.");
            return;
        }
        setEnviando(true);
        const cargando = toast.loading("Enviando traspasos…");
        try {
            const respuesta = await createTransferOrders(pendientesParaEnviar);
            if (!respuesta.success) {
                toast.error(respuesta.error || "No se pudieron enviar los traspasos.", { id: cargando });
            } else if (respuesta.mock) {
                toast.warning(respuesta.message || "Modo de prueba: no se envió nada al sistema", { id: cargando });
            } else {
                // Envío real exitoso: los marcamos como hechos para que no se envíen dos veces
                rutasPendientes.forEach((g) => marcarAlerta("traspasos", g.id, true));
                toast.success(
                    `${plural(rutasPendientes.length, "traspaso enviado", "traspasos enviados")} al sistema y marcados como hechos.`,
                    { id: cargando }
                );
            }
        } catch (error: any) {
            toast.error(error?.message || "No pudimos conectar con el sistema.", { id: cargando });
        } finally {
            setEnviando(false);
        }
    };

    // --- Sin alertas ---
    if (alerts.length === 0) {
        const hayDatos = !!masterData && masterData.length > 0;
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="bg-white border border-slate-200 rounded-2xl px-8 py-12 max-w-xl w-full text-center flex flex-col items-center gap-3">
                    <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                            hayDatos ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                        }`}
                        aria-hidden="true"
                    >
                        {hayDatos ? <CheckCircle2 className="w-7 h-7" /> : <Inbox className="w-7 h-7" />}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                        {hayDatos ? "No hay alertas por ahora" : "Todavía no hay datos cargados"}
                    </h2>
                    <p className="text-[#475569] max-w-md">
                        {hayDatos
                            ? "Con los archivos que cargaste no encontramos traspasos ni compras pendientes."
                            : "Aquí verás qué traspasar y qué comprar en cuanto cargues tus archivos de existencias y ventas."}
                    </p>
                    {!hayDatos && (
                        <button
                            onClick={() => setActiveView("cargar")}
                            className="mt-2 min-h-[44px] px-5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                        >
                            Ir a cargar datos
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const porcentaje = totalVista > 0 ? Math.round((hechosVista / totalVista) * 100) : 0;
    const etiquetaAvance = esTraspasos
        ? `${num(hechosVista)} de ${num(totalVista)} traspasos hechos`
        : `${num(hechosVista)} de ${num(totalVista)} compras pedidas`;

    const pestanas: { id: Pestana; texto: string }[] = [
        { id: "traspasos", texto: `Traspasos (${num(pendientes.traspasos)})` },
        { id: "compras", texto: `Compras (${num(pendientes.compras)})` },
    ];

    return (
        <div className="flex flex-col h-full bg-[#F6F8FB]">
            <header className="bg-white border-b border-slate-200 px-6 pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-900">Alertas</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={exportar}
                            disabled={cantidadVisible === 0}
                            className="flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                            <Download className="w-4 h-4" aria-hidden="true" /> Exportar a Excel
                        </button>
                        {esTraspasos && (
                            <button
                                type="button"
                                onClick={enviarTraspasos}
                                disabled={pendientes.traspasos === 0 || enviando}
                                className="flex items-center gap-2 min-h-[44px] px-4 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                {enviando ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Enviando…</>
                                ) : (
                                    <><CloudUpload className="w-4 h-4" aria-hidden="true" /> Enviar traspasos</>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {MODO_PRUEBA && (
                    <div className="flex items-start gap-2 rounded-lg bg-[#FEF3C7] px-3 py-2 text-sm text-[#92400E]">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-[#F59E0B]" aria-hidden="true" />
                        <p>
                            <span className="font-semibold">Conexión en modo de prueba.</span> Todavía no hay un token configurado, así que
                            “Enviar traspasos” no manda nada al sistema.
                        </p>
                    </div>
                )}

                {/* Pestañas */}
                <div role="tablist" aria-label="Tipo de alerta" className="flex gap-1">
                    {pestanas.map((p) => {
                        const activa = pestana === p.id;
                        return (
                            <button
                                key={p.id}
                                role="tab"
                                type="button"
                                id={`pestana-${p.id}`}
                                aria-selected={activa}
                                aria-controls="panel-alertas"
                                onClick={() => {
                                    setPestana(p.id);
                                    setPagina(1);
                                }}
                                className={cn(
                                    "min-h-[44px] px-5 text-sm font-semibold border-b-2 transition-colors",
                                    activa
                                        ? "border-[#2563EB] text-[#2563EB]"
                                        : "border-transparent text-[#475569] hover:text-slate-900"
                                )}
                            >
                                {p.texto}
                            </button>
                        );
                    })}
                </div>
            </header>

            {/* Filtros y avance */}
            <div className="px-6 pt-4 pb-2 flex flex-col gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[220px] max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" aria-hidden="true" />
                        <input
                            type="search"
                            aria-label="Buscar por producto o clave"
                            placeholder="Buscar por producto o clave"
                            value={busqueda}
                            onChange={(e) => {
                                setBusqueda(e.target.value);
                                setPagina(1);
                            }}
                            className="w-full min-h-[44px] bg-white border border-slate-300 rounded-lg pl-10 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                    </div>

                    <select
                        aria-label="Filtrar por sucursal"
                        value={sucursal}
                        onChange={(e) => {
                            setSucursal(e.target.value);
                            setPagina(1);
                        }}
                        className="min-h-[44px] bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                        <option value="TODAS">Todas las sucursales</option>
                        {SUCURSALES.map((s) => (
                            <option key={s} value={s}>
                                {nombreSucursal(s)}
                            </option>
                        ))}
                    </select>

                    <label className="min-h-[44px] flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={soloPendientes}
                            onChange={(e) => {
                                setSoloPendientes(e.target.checked);
                                setPagina(1);
                            }}
                            className="w-5 h-5 accent-[#2563EB]"
                        />
                        Solo pendientes
                    </label>

                    {hayFiltros && (
                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            className="min-h-[44px] px-3 text-sm font-semibold text-[#2563EB] underline hover:text-blue-800"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>

                <div className="max-w-xl">
                    <p className="text-sm text-slate-800 mb-1">{etiquetaAvance}</p>
                    <div
                        role="progressbar"
                        aria-label={etiquetaAvance}
                        aria-valuemin={0}
                        aria-valuemax={totalVista}
                        aria-valuenow={hechosVista}
                        className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden"
                    >
                        <div className="h-full bg-[#16A34A] transition-all" style={{ width: `${porcentaje}%` }} />
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div id="panel-alertas" role="tabpanel" aria-labelledby={`pestana-${pestana}`} className="flex-1 overflow-auto px-6 pb-6 pt-2">
                {cantidadVisible === 0 ? (
                    <div className="flex flex-col items-center justify-center mt-16 gap-2 text-center">
                        <span className="text-base font-semibold text-slate-800">
                            {hayFiltros ? "No hay alertas con estos filtros" : esTraspasos ? "No hay traspasos" : "No hay compras"}
                        </span>
                        {hayFiltros && (
                            <>
                                <p className="text-sm text-[#475569]">Prueba con otra sucursal o borra la búsqueda.</p>
                                <button
                                    type="button"
                                    onClick={limpiarFiltros}
                                    className="mt-2 min-h-[44px] px-5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    Limpiar filtros
                                </button>
                            </>
                        )}
                    </div>
                ) : esTraspasos ? (
                    <div className="flex flex-col gap-3">
                        {gruposVisibles.map((g, i) => (
                            <TarjetaTraspaso
                                key={g.id}
                                grupo={g}
                                hecho={!!alertasHechas.traspasos[g.id]}
                                abierto={abiertos[g.id] ?? i === 0}
                                onAbrir={() => setAbiertos((prev) => ({ ...prev, [g.id]: !(prev[g.id] ?? i === 0) }))}
                                onMarcar={() => marcarAlerta("traspasos", g.id, !alertasHechas.traspasos[g.id])}
                            />
                        ))}
                    </div>
                ) : (
                    <>
                        <ul className="flex flex-col gap-3">
                            {comprasPagina.map((a) => (
                                <FilaCompra
                                    key={a.clave}
                                    alerta={a}
                                    pedida={!!alertasHechas.compras[a.clave]}
                                    onMarcar={() => marcarAlerta("compras", a.clave, !alertasHechas.compras[a.clave])}
                                />
                            ))}
                        </ul>
                        <nav aria-label="Páginas de compras" className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                            <button
                                type="button"
                                disabled={paginaActual <= 1}
                                onClick={() => setPagina(paginaActual - 1)}
                                className="min-h-[44px] px-5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                            >
                                &larr; Anterior
                            </button>
                            <span className="text-sm text-[#475569]">
                                Página {paginaActual} de {totalPaginas} · {plural(comprasVisibles.length, "compra", "compras")}
                            </span>
                            <button
                                type="button"
                                disabled={paginaActual >= totalPaginas}
                                onClick={() => setPagina(paginaActual + 1)}
                                className="min-h-[44px] px-5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                            >
                                Siguiente &rarr;
                            </button>
                        </nav>
                    </>
                )}
            </div>
        </div>
    );
};

export default Alertas;

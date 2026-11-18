import React, { useMemo } from "react";
import { ArrowRightLeft, ChevronRight, Package, ShoppingCart, Store, TrendingUp, Upload } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { useAppContext, type PestanaAlertas } from "../../AppContext";
import { contarPendientes } from "../../lib/alertas";
import { ESTADOS, ORDEN_ESTADOS, type EstadoRotacion } from "../../lib/estados";
import { formatearFechaLarga, limpiarNombreProducto } from "../../lib/utils";

const num = (n: number) => n.toLocaleString("es-MX");

// Tarjeta grande que lleva a Alertas
const TarjetaPendientes: React.FC<{
    titulo: string;
    cantidad: number;
    ayuda: string;
    icono: React.ReactNode;
    onClick: () => void;
}> = ({ titulo, cantidad, ayuda, icono, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="min-h-[44px] text-left bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4 hover:border-[#2563EB] hover:shadow transition-colors focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
    >
        <div className="p-3 bg-blue-50 text-[#2563EB] rounded-lg shrink-0" aria-hidden="true">
            {icono}
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800">{titulo}</p>
            <p className="text-3xl font-bold text-slate-900 leading-tight">{num(cantidad)}</p>
            <p className="text-sm text-[#475569]">{ayuda}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-[#475569] shrink-0" aria-hidden="true" />
    </button>
);

const Inicio: React.FC = () => {
    const { masterData, alerts, alertasHechas, loadInfo, setActiveView, setAlertasPestana } = useAppContext();

    const irAAlertas = (pestana: PestanaAlertas) => {
        setAlertasPestana(pestana);
        setActiveView("alertas");
    };

    const pendientes = useMemo(() => contarPendientes(alerts, alertasHechas), [alerts, alertasHechas]);

    const datos = useMemo(() => {
        if (!masterData || masterData.length === 0) return null;

        let conExistencia = 0;
        let piezas = 0;
        const sucursales = new Set<string>();
        const conteo: Record<EstadoRotacion, number> = {
            "ROTACIÓN ACTIVA": 0,
            "NULA ROTACIÓN": 0,
            "COMPRA URGENTE": 0,
            "SIN MOVIMIENTO": 0,
        };

        masterData.forEach((item) => {
            if ((item.exist || 0) > 0) conExistencia++;
            piezas += item.exist || 0;
            Object.keys(item.sucursales).forEach((s) => sucursales.add(s));
            const estado = item.raw["Estado_Rotacion"] as EstadoRotacion;
            if (estado in conteo) conteo[estado]++;
        });

        const top5 = [...masterData]
            .sort((a, b) => (b.exist || 0) - (a.exist || 0))
            .slice(0, 5)
            .map((p) => ({ nombre: limpiarNombreProducto(p.articulo), clave: p.clave, existencia: p.exist || 0 }));

        const dona = ORDEN_ESTADOS.map((k) => ({ clave: k, name: ESTADOS[k].etiqueta, value: conteo[k], color: ESTADOS[k].color })).filter(
            (d) => d.value > 0
        );

        return { filas: masterData.length, conExistencia, piezas, sucursales: sucursales.size, conteo, dona, top5 };
    }, [masterData]);

    // Pantalla de bienvenida si no hay datos
    if (!datos) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#F6F8FB] text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6" aria-hidden="true">
                    <Store className="w-12 h-12 text-[#2563EB]" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenido a Omega</h1>
                <p className="text-[#475569] max-w-lg leading-relaxed">
                    Para ver tu resumen, carga tus archivos de existencias y ventas. Te decimos qué traspasar entre sucursales y qué comprar.
                </p>
                <button
                    type="button"
                    onClick={() => setActiveView("cargar")}
                    className="mt-6 min-h-[44px] px-6 flex items-center gap-2 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                    <Upload className="w-4 h-4" aria-hidden="true" /> Ir a cargar datos
                </button>
            </div>
        );
    }

    const maxTop = Math.max(1, ...datos.top5.map((p) => p.existencia));
    const totalDona = datos.dona.reduce((t, d) => t + d.value, 0);

    return (
        <div className="flex-1 overflow-y-auto bg-[#F6F8FB] p-6 sm:p-8">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Resumen</h1>
                {loadInfo && (
                    <p className="text-sm text-[#475569] mt-1">
                        Datos de {loadInfo.existenciasName} y {loadInfo.ventasName}, cargados el {formatearFechaLarga(loadInfo.loadedAt)}.
                    </p>
                )}
            </header>

            {/* Lo que hay que hacer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <TarjetaPendientes
                    titulo="Traspasos por hacer"
                    cantidad={pendientes.traspasos}
                    ayuda="Ver en Alertas"
                    icono={<ArrowRightLeft className="w-6 h-6" />}
                    onClick={() => irAAlertas("traspasos")}
                />
                <TarjetaPendientes
                    titulo="Compras por pedir"
                    cantidad={pendientes.compras}
                    ayuda="Ver en Alertas"
                    icono={<ShoppingCart className="w-6 h-6" />}
                    onClick={() => irAAlertas("compras")}
                />
            </div>

            {/* Números generales */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-[#2563EB] rounded-lg" aria-hidden="true">
                        <Package className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Productos con existencia</p>
                        <p className="text-2xl font-bold text-slate-900">{num(datos.conExistencia)}</p>
                        <p className="text-sm text-[#475569]">de {num(datos.filas)} filas en tu archivo</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-[#2563EB] rounded-lg" aria-hidden="true">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Piezas en toda la red</p>
                        <p className="text-2xl font-bold text-slate-900">{num(datos.piezas)}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-[#2563EB] rounded-lg" aria-hidden="true">
                        <Store className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-800">Sucursales</p>
                        <p className="text-2xl font-bold text-slate-900">{num(datos.sucursales)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Salud del inventario */}
                <section aria-labelledby="titulo-salud" className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <h2 id="titulo-salud" className="text-base font-semibold text-slate-900 mb-4">
                        Salud del inventario
                    </h2>
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="w-48 h-48 shrink-0" role="img" aria-label="Gráfica de dona con los productos por estado de rotación">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={datos.dona} innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value" stroke="none">
                                        {datos.dona.map((d) => (
                                            <Cell key={d.clave} fill={d.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => [`${num(Number(value))} productos`, String(name)]}
                                        contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <ul className="flex flex-col gap-3 flex-1">
                            {ORDEN_ESTADOS.map((k) => {
                                const e = ESTADOS[k];
                                const n = datos.conteo[k];
                                return (
                                    <li key={k} className="flex items-start gap-3">
                                        <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: e.color }} aria-hidden="true" />
                                        <p className="text-sm text-slate-800">
                                            <span className="font-semibold">{e.etiqueta}</span>
                                            <span className="text-slate-900">
                                                {" "}
                                                · {num(n)} {totalDona > 0 ? `(${Math.round((n / totalDona) * 100)} %)` : ""}
                                            </span>
                                            <span className="block text-[#475569]">{e.ayuda}</span>
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </section>

                {/* Top 5 */}
                <section aria-labelledby="titulo-top" className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                    <h2 id="titulo-top" className="text-base font-semibold text-slate-900 mb-4">
                        Los 5 productos con más piezas
                    </h2>
                    <ol className="flex flex-col gap-4">
                        {datos.top5.map((p) => (
                            <li key={p.clave}>
                                <div className="flex items-baseline justify-between gap-3 mb-1">
                                    <span className="text-sm text-slate-800 truncate" title={p.nombre}>
                                        {p.nombre}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-900 shrink-0">{num(p.existencia)}</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                                    <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${(p.existencia / maxTop) * 100}%` }} />
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </div>
    );
};

export default Inicio;

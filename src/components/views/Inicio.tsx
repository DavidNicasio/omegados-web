import React, { useState, useMemo } from "react";
import {
    Package,
    ArrowRightLeft,
    ShoppingCart,
    TrendingUp,
    Store
} from "lucide-react";
import { useAppContext } from "../../AppContext";
import { SUCURSALES } from "../../lib/constants";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Legend
} from "recharts";

const COLORS = {
    "ROTACIÓN ACTIVA": "#22c55e", // Verde
    "NULA ROTACIÓN": "#f59e0b",   // Ambar
    "COMPRA URGENTE": "#ef4444",  // Rojo
    "SIN MOVIMIENTO": "#94a3b8",  // Gris
};

const Inicio: React.FC = () => {
    const { masterData, alerts } = useAppContext();
    const [filtroSucursal, setFiltroSucursal] = useState("GLOBAL");

    // Cálculos dinámicos basados en la sucursal seleccionada
    const dashboardData = useMemo(() => {
        if (!masterData || masterData.length === 0) return null;

        let totalArticulos = 0;
        let piezasFisicas = 0;

        // Contadores para el gráfico de Dona (Salud de Inventario)
        const conteoSalud = {
            "ROTACIÓN ACTIVA": 0,
            "NULA ROTACIÓN": 0,
            "COMPRA URGENTE": 0,
            "SIN MOVIMIENTO": 0,
        };

        // Top 5 Productos con más stock
        let productosStock: { nombre: string; stock: number }[] = [];

        masterData.forEach((item) => {
            totalArticulos++;

            // Determinar qué columna leer según el filtro
            if (filtroSucursal === "GLOBAL") {
                piezasFisicas += item.exist || 0;
                const estado = item.raw["Estado_Rotacion"] as keyof typeof conteoSalud || "SIN MOVIMIENTO";
                if (conteoSalud[estado] !== undefined) conteoSalud[estado]++;

                productosStock.push({
                    nombre: item.articulo.substring(0, 20) + "...",
                    stock: item.exist || 0
                });
            } else {
                const stockLocal = item.sucursales[filtroSucursal] || 0;
                piezasFisicas += stockLocal;

                const estadoLocal = item.raw[`Rotacion_${filtroSucursal}`] as keyof typeof conteoSalud || "SIN MOVIMIENTO";
                if (conteoSalud[estadoLocal] !== undefined) conteoSalud[estadoLocal]++;

                productosStock.push({
                    nombre: item.articulo.substring(0, 20) + "...",
                    stock: stockLocal
                });
            }
        });

        // Filtrar alertas según la sucursal
        const alertasFiltradas = alerts.filter(a =>
            filtroSucursal === "GLOBAL" ||
            a.origen === filtroSucursal ||
            a.destino === filtroSucursal
        );

        const comprasUrgentes = alertasFiltradas.filter(a => a.tipo === "COMPRA").length;
        const traspasosSugeridos = alertasFiltradas.filter(a => a.tipo === "TRASPASO").length;

        // Formatear datos para Recharts
        const dataDona = Object.keys(conteoSalud).map(key => ({
            name: key,
            value: conteoSalud[key as keyof typeof conteoSalud]
        })).filter(d => d.value > 0);

        const top5Stock = productosStock
            .sort((a, b) => b.stock - a.stock)
            .slice(0, 5);

        return {
            totalArticulos,
            piezasFisicas,
            comprasUrgentes,
            traspasosSugeridos,
            dataDona,
            top5Stock,
            alertasRecientes: alertasFiltradas.slice(0, 6) // Solo mostrar las últimas 6
        };
    }, [masterData, alerts, filtroSucursal]);

    // Pantalla de Bienvenida si no hay datos
    if (!dashboardData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                    <Store className="w-12 h-12 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenido a Farmacia ERP</h1>
                <p className="text-slate-500 max-w-lg text-center leading-relaxed">
                    Para comenzar a visualizar tu panel de control interactivo, por favor carga tus archivos de existencias y ventas desde la pestaña de <b>Rotación</b> o <b>Sincronizar</b>.
                </p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8">
            {/* HEADER Y FILTRO */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Panel de Control</h1>
                    <p className="text-sm text-slate-500">Resumen operativo y salud del inventario</p>
                </div>

                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2">Vista:</span>
                    <select
                        value={filtroSucursal}
                        onChange={(e) => setFiltroSucursal(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-700 py-1 px-2 focus:outline-none cursor-pointer"
                    >
                        <option value="GLOBAL">Red Global</option>
                        <optgroup label="Sucursales">
                            {SUCURSALES.map(s => (
                                <option key={s} value={s.toUpperCase()}>{s.toUpperCase()}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>
            </header>

            {/* KPIS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Package className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Catálogo Activo</p>
                        <h3 className="text-2xl font-black text-slate-800">{dashboardData.totalArticulos.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><TrendingUp className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Piezas Físicas</p>
                        <h3 className="text-2xl font-black text-slate-800">{dashboardData.piezasFisicas.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg"><ShoppingCart className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Compras Urgentes</p>
                        <h3 className="text-2xl font-black text-slate-800">{dashboardData.comprasUrgentes.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><ArrowRightLeft className="w-6 h-6" /></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Traspasos Pendientes</p>
                        <h3 className="text-2xl font-black text-slate-800">{dashboardData.traspasosSugeridos.toLocaleString()}</h3>
                    </div>
                </div>
            </div>

            {/* CHARTS GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

                {/* GRÁFICO DONA - SALUD DE INVENTARIO */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col h-[380px]">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Estado y Rotación</h3>
                    <div className="flex-1 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dashboardData.dataDona}
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {dashboardData.dataDona.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || COLORS["SIN MOVIMIENTO"]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => [value.toLocaleString() + " Artículos", "Cantidad"]}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* GRÁFICO BARRAS - TOP INVENTARIO ESTANCADO O MAYOR STOCK */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col h-[380px]">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Top 5 Volumen de Stock</h3>
                    <div className="flex-1 w-full mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dashboardData.top5Stock} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="nombre" type="category" width={140} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="stock" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* FEED DE ALERTAS RECIENTES */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Alertas Críticas Recientes</h3>
                </div>
                <div className="p-0">
                    {dashboardData.alertasRecientes.length === 0 ? (
                        <div className="p-8 text-center text-sm font-bold text-slate-400 uppercase tracking-wider">
                            No hay alertas pendientes para esta vista.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <tbody>
                            {dashboardData.alertasRecientes.map((alerta, idx) => (
                                <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                    <td className="p-4 w-12 text-center">
                                        {alerta.tipo === "COMPRA" ? (
                                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600">🛒</div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">📦</div>
                                        )}
                                    </td>
                                    <td className="p-4 font-bold text-slate-700 w-1/3 truncate max-w-[200px]" title={alerta.producto}>
                                        {alerta.producto}
                                    </td>
                                    <td className="p-4 font-mono text-slate-500">ID: {alerta.clave}</td>
                                    <td className="p-4 text-right">
                                        {alerta.tipo === "COMPRA" ? (
                                            <span className="px-2 py-1 bg-red-50 text-red-700 font-bold rounded text-[10px] border border-red-100">
                          URGENTE PARA {alerta.destino}
                        </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-slate-500 flex items-center justify-end gap-2">
                          <span className="px-2 py-1 bg-white border border-slate-200 rounded">{alerta.origen}</span>
                          <ArrowRightLeft className="w-3 h-3 text-slate-300" />
                          <span className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded">{alerta.destino}</span>
                        </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Inicio;
import * as XLSX from "xlsx";
import { SUCURSALES, STOCK_BAJO } from "./constants";

export interface Alert {
    tipo: "COMPRA" | "TRASPASO";
    producto: string;
    clave: string;
    origen: string;
    destino: string;
    cantidad: number | "REVISAR";
}

export interface MasterRow {
    clave: string;
    articulo: string;
    exist: number;
    sucursales: Record<string, number>;
    raw: Record<string, any>;
    [key: string]: any;
}

// =========================================================================
// CÓDIGO ORIGINAL INTACTO (Para evitar pantallas blancas en Inicio.tsx)
// =========================================================================

export const processMasterFile = async (
    file: File
): Promise<{ data: MasterRow[]; alertas: Alert[]; rawColumns: string[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: "binary" });

                let wsName = wb.SheetNames.find((n) =>
                    /todos|rotacion|maestro|inventario/i.test(n)
                );
                if (!wsName) {
                    wsName = wb.SheetNames[0];
                }

                const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1 }) as any[][];
                if (rows.length < 2) throw new Error("El archivo está vacío o no tiene el formato esperado");

                const header0 = rows[0] || [];
                const header1 = rows[1] || [];

                const monthNamesSet = new Set<string>();
                header1.forEach(v => {
                    const hStr = String(v || "").trim().toUpperCase();
                    const match = hStr.match(/^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SEPT|OCT|NOV|DIC)/i);
                    if (match) {
                        monthNamesSet.add(hStr);
                    }
                });

                const isMultiIndex = monthNamesSet.size > 0;
                const numMeses = isMultiIndex ? monthNamesSet.size : 1;

                let rawColumns: string[] = [];
                let dataStartIndex = 1;

                if (isMultiIndex) {
                    dataStartIndex = 2;
                    let lastH0 = "";
                    for (let i = 0; i < Math.max(header0.length, header1.length); i++) {
                        const val0 = (header0[i] !== undefined && header0[i] !== null) ? String(header0[i]).trim() : "";
                        if (val0 !== "") lastH0 = val0;

                        const val1 = (header1[i] !== undefined && header1[i] !== null) ? String(header1[i]).trim() : "";

                        if (!val1 || val1.toLowerCase().includes('unnamed') || val1 === lastH0) {
                            rawColumns.push(lastH0 || `COL_${i}`);
                        } else {
                            rawColumns.push(`${lastH0}_${val1}`);
                        }
                    }
                } else {
                    rawColumns = header0.map((v, i) => v ? String(v).trim() : `COL_${i}`);
                }

                let colClaveIdx = -1;
                let colArtIdx = -1;
                let colExistIdx = -1;

                rawColumns = rawColumns.map((c, i) => {
                    const low = c.toLowerCase();
                    if (colClaveIdx === -1 && (low.includes('códig') || low.includes('codig') || low.includes('cod') || low.includes('clave'))) {
                        colClaveIdx = i;
                        return 'Clave';
                    }
                    if (colArtIdx === -1 && (low.includes('artícul') || low.includes('articul') || low.includes('descrip'))) {
                        colArtIdx = i;
                        return 'Artículo';
                    }
                    if (colExistIdx === -1 && low.includes('exist')) {
                        colExistIdx = i;
                        return 'Exist';
                    }
                    return c;
                });

                const rawJson: any[] = [];
                for (let r = dataStartIndex; r < rows.length; r++) {
                    const rowData = rows[r];
                    if (!rowData || rowData.length === 0 || rowData.every(v => v === undefined || v === null || String(v).trim() === "")) continue;

                    const obj: Record<string, any> = {};
                    for (let c = 0; c < rawColumns.length; c++) {
                        obj[rawColumns[c]] = rowData[c];
                    }
                    rawJson.push(obj);
                }

                const processedList: MasterRow[] = [];
                const alerts: Alert[] = [];
                const SUC_UP = SUCURSALES.map((s) => s.toUpperCase());

                rawJson.forEach((row) => {
                    let clave = String(row["Clave"] || "");
                    if (!clave || clave.trim() === "undefined" || clave.trim() === "" || clave.toLowerCase() === "clave")
                        return;

                    if (clave.endsWith(".0") && !isNaN(Number(clave.slice(0, -2))))
                        clave = clave.slice(0, -2);

                    const articulo = String(row["Artículo"] || "Sin nombre");
                    const sucData: Record<string, number> = {};
                    let groupDataBySucTotal: Record<string, number> = {};
                    let totalGeneral = 0;

                    rawColumns.forEach((key) => {
                        if (key === "Clave" || key === "Artículo" || key === "Exist") return;
                        const kUp = key.toUpperCase().trim();
                        const isSuc = SUC_UP.find((s) => kUp === s || kUp.startsWith(s + "_") || kUp.startsWith(s + " "));

                        if (isSuc) {
                            const val = row[key];
                            if (val !== undefined && val !== null && String(val).trim() !== "") {
                                const cleanedVal = String(val).replace(/[^0-9.-]/g, "");
                                const v = parseFloat(cleanedVal) || 0;
                                sucData[key] = v;
                                groupDataBySucTotal[isSuc] = (groupDataBySucTotal[isSuc] || 0) + v;
                                totalGeneral += v;
                            }
                        }
                    });

                    let exist = 0;
                    if (row["Exist"] !== undefined && row["Exist"] !== null && String(row["Exist"]).trim() !== "") {
                        exist = parseFloat(String(row["Exist"]).replace(/[^0-9.-]/g, "")) || 0;
                    } else {
                        exist = totalGeneral;
                    }

                    const visualRaw: Record<string, any> = {};
                    rawColumns.forEach(c => visualRaw[c] = row[c] ?? "");
                    visualRaw["Clave"] = clave;
                    visualRaw["Exist"] = exist;

                    processedList.push({ clave, articulo, exist, sucursales: sucData, raw: visualRaw });

                    if (isMultiIndex || (row["Exist"] !== undefined && String(row["Exist"]).trim() !== "")) {
                        const ventaPromedioMensualGlobal = totalGeneral / numMeses;
                        const coberturaDiasGlobal = ventaPromedioMensualGlobal > 0 ? (exist / ventaPromedioMensualGlobal) * 30 : 9999;

                        if (exist <= 2 || coberturaDiasGlobal < 15) {
                            alerts.push({ tipo: "COMPRA", producto: articulo, clave, origen: "PROVEEDOR", destino: "ABASTOS", cantidad: "REVISAR" });
                        } else {
                            let highestSuc = "";
                            let maxVenta = 0;
                            Object.keys(groupDataBySucTotal).forEach(s => {
                                let ventaPromedioLocal = groupDataBySucTotal[s] / numMeses;
                                if (ventaPromedioLocal > maxVenta) {
                                    maxVenta = ventaPromedioLocal;
                                    highestSuc = s;
                                }
                            });
                            if (highestSuc && maxVenta > 0) {
                                alerts.push({ tipo: "TRASPASO", producto: articulo, clave, origen: highestSuc !== "ABASTOS" ? "ABASTOS" : "MATRIZ", destino: highestSuc, cantidad: Math.max(2, Math.ceil(maxVenta)) });
                            }
                        }
                    }
                });

                resolve({ data: processedList, alertas: alerts, rawColumns });
            } catch (err: any) {
                reject(err.message || "Error excel");
            }
        };
        reader.onerror = () => reject("Error al procesar el archivo.");
        reader.readAsBinaryString(file);
    });
};

export const exportToExcel = (dataToExport: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
};


// =========================================================================
// NUEVA LÓGICA: CRUCE DE VENTAS Y EXISTENCIAS (Reglas Exactas de la Clienta)
// =========================================================================

// Normaliza nombres como "santarosa" a "SANTA ROSA"
const normSucursal = (nombre: string) => {
    let limpio = nombre.toLowerCase().replace("sucursal", "").trim();
    if (limpio === "santarosa") return "SANTA ROSA";
    if (limpio === "torre medica" || limpio === "torremedica") return "TORRE MEDICA";
    return limpio.toUpperCase();
};

export const procesarRotacionCruzada = async (
    fileVentas: File,
    fileExistencias: File
): Promise<{ data: MasterRow[]; alertas: Alert[]; rawColumns: string[] }> => {

    // 1. Leer Ventas
    const dataVentas = await fileVentas.arrayBuffer();
    const wbVentas = XLSX.read(dataVentas, { type: "array" });
    const rawVentas = XLSX.utils.sheet_to_json(wbVentas.Sheets[wbVentas.SheetNames[0]]) as any[];

    // clave -> { maxSucursal: "", maxVentas: 0, totalGlobal: 0, sucursales: { "ABASTOS": 10 } }
    const diccionarioVentas: Record<string, any> = {};

    rawVentas.forEach((row) => {
        const clave = String(row["CLAVE"] || row["Clave"] || "").trim().toUpperCase();
        if (!clave || clave === "000XXX") return;

        const sucursal = normSucursal(String(row["SUCURSAL"] || row["Sucursal"] || ""));
        const total = Number(row["TOTAL"] || row["Total"] || 0);

        if (!diccionarioVentas[clave]) {
            diccionarioVentas[clave] = { maxSucursal: "", maxVentas: 0, totalGlobal: 0, sucursales: {} };
        }

        diccionarioVentas[clave].sucursales[sucursal] = (diccionarioVentas[clave].sucursales[sucursal] || 0) + total;
        diccionarioVentas[clave].totalGlobal += total;

        // Registrar quién vende más para los traspasos futuros
        if (diccionarioVentas[clave].sucursales[sucursal] > diccionarioVentas[clave].maxVentas) {
            diccionarioVentas[clave].maxVentas = diccionarioVentas[clave].sucursales[sucursal];
            diccionarioVentas[clave].maxSucursal = sucursal;
        }
    });

    // 2. Leer Existencias
    const dataExist = await fileExistencias.arrayBuffer();
    const wbExist = XLSX.read(dataExist, { type: "array" });
    const rawExist = XLSX.utils.sheet_to_json(wbExist.Sheets[wbExist.SheetNames[0]]) as any[];

    const productosList: MasterRow[] = [];
    const alertasGeneradas: Alert[] = [];

    // Columnas que enviaremos a la tabla
    const rawColumns = ["Clave", "Artículo", "Exist", "Ventas_Global", "Estado_Rotacion", ...SUCURSALES.map(s => s.toUpperCase())];

    rawExist.forEach((row) => {
        // Buscar llaves correctas independientemente de espacios
        const claveKey = Object.keys(row).find((k) => k.toLowerCase().includes("clave"));
        const articuloKey = Object.keys(row).find((k) => k.toLowerCase().includes("articulo"));

        if (!claveKey || !articuloKey) return;

        const clave = String(row[claveKey]).trim().toUpperCase();
        const articulo = String(row[articuloKey]).trim();

        if (!clave || clave === "000XXX" || clave.toLowerCase().includes("clave")) return;

        const ventasDelProducto = diccionarioVentas[clave] || { maxSucursal: "", maxVentas: 0, totalGlobal: 0, sucursales: {} };

        let existGlobal = 0;
        const stockSucursales: Record<string, number> = {};

        const visualRaw: Record<string, any> = {
            Clave: clave,
            Artículo: articulo,
            Ventas_Global: ventasDelProducto.totalGlobal
        };

        // Procesar inventario por sucursal
        Object.keys(row).forEach((k) => {
            const col = k.toLowerCase().trim();
            const val = Number(row[k]) || 0;

            if (col === "general") {
                existGlobal = val;
            } else {
                const sucNorm = normSucursal(k);
                if (SUCURSALES.map(s => s.toUpperCase()).includes(sucNorm)) {
                    stockSucursales[sucNorm] = val;
                    visualRaw[sucNorm] = val; // Poner el stock en la columna para que la tabla pinte colores

                    // ----------------------------------------------------
                    // REGLA DEL CLIENTE: EVALUACIÓN DE NULA ROTACIÓN
                    // ----------------------------------------------------
                    const ventaEnEstaSucursal = ventasDelProducto.sucursales[sucNorm] || 0;

                    if (val > 0 && ventaEnEstaSucursal === 0) {
                        // NULA ROTACIÓN = Revisar quién vende y hacer traspaso
                        if (ventasDelProducto.maxVentas > 0 && ventasDelProducto.maxSucursal !== sucNorm) {
                            alertasGeneradas.push({
                                tipo: "TRASPASO",
                                producto: articulo,
                                clave: clave,
                                origen: sucNorm, // De la sucursal que no lo vende
                                destino: ventasDelProducto.maxSucursal, // A la sucursal que más lo vende
                                cantidad: val // Mandamos el stock estancado
                            });
                        }
                    }
                }
            }
        });

        if (existGlobal === 0) {
            existGlobal = Object.values(stockSucursales).reduce((a, b) => a + b, 0);
        }

        // Regla de Compra (Se vende pero no hay stock)
        if (existGlobal <= 0 && ventasDelProducto.totalGlobal > 0) {
            alertasGeneradas.push({
                tipo: "COMPRA",
                producto: articulo,
                clave: clave,
                origen: "PROVEEDOR",
                destino: "VARIAS",
                cantidad: "REVISAR"
            });
            visualRaw["Estado_Rotacion"] = "COMPRA URGENTE";
        } else if (existGlobal > 0 && ventasDelProducto.totalGlobal === 0) {
            visualRaw["Estado_Rotacion"] = "NULA ROTACIÓN";
        } else {
            visualRaw["Estado_Rotacion"] = "ROTACIÓN ACTIVA";
        }

        visualRaw["Exist"] = existGlobal;

        productosList.push({
            clave,
            articulo,
            exist: existGlobal,
            sucursales: stockSucursales,
            raw: visualRaw
        });
    });

    return { data: productosList, alertas: alertasGeneradas, rawColumns };
};
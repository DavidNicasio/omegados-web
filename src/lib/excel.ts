import * as XLSX from "xlsx";
import XLSXStyle from "xlsx-js-style";
import { SUCURSALES, STOCK_BAJO, MESES } from "./constants";

export interface Alert {
    tipo: "COMPRA" | "TRASPASO";
    producto: string;
    clave: string;
    origen: string;
    destino: string;
    cantidad: number | "REVISAR";
    sucursales?: string[];
}

export interface MasterRow {
    clave: string;
    articulo: string;
    exist: number;
    sucursales: Record<string, number>; // existencia por sucursal
    ventasPorSucursal: Record<string, number>; // ventas acumuladas por sucursal
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

                    processedList.push({ clave, articulo, exist, sucursales: sucData, ventasPorSucursal: {}, raw: visualRaw });

                    if (isMultiIndex || (row["Exist"] !== undefined && String(row["Exist"]).trim() !== "")) {
                        const ventaPromedioMensualGlobal = totalGeneral / numMeses;
                        const coberturaDiasGlobal = ventaPromedioMensualGlobal > 0 ? (exist / ventaPromedioMensualGlobal) * 30 : 9999;

                        if (exist <= 2 || coberturaDiasGlobal < 15) {
                            // Cantidad sugerida = promedio mensual x 2 meses de cobertura
                            const cantidadSugeridaCompra: number | "REVISAR" = ventaPromedioMensualGlobal > 0
                                ? Math.max(1, Math.ceil(ventaPromedioMensualGlobal * 2))
                                : "REVISAR";
                            // Destino = sucursal con mayor venta, o ABASTOS por defecto
                            let destinoCompra = "ABASTOS";
                            let maxVentaLocal = 0;
                            Object.keys(groupDataBySucTotal).forEach(s => {
                                if (groupDataBySucTotal[s] > maxVentaLocal) {
                                    maxVentaLocal = groupDataBySucTotal[s];
                                    destinoCompra = s;
                                }
                            });
                            alerts.push({ tipo: "COMPRA", producto: articulo, clave, origen: "PROVEEDOR", destino: destinoCompra, cantidad: cantidadSugeridaCompra });
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

// =========================================================================
// ESTILOS PREDEFINIDOS PARA EXCEL PROFESIONAL
// =========================================================================

type XLSXBorderStyle = "thin" | "medium" | "thick" | "dotted" | "hair" | "dashed" | "mediumDashed" | "dashDot" | "mediumDashDot" | "slantDashDot";

const BRAND_BLUE = "1A3A5C";
const BRAND_BLUE_LIGHT = "2F6EBA";
const HEADER_BG = "0F2B4A";
const HEADER_FG = "FFFFFF";
const SECTION_BG = "E8F0FB";

const BORDER_STYLE: XLSXBorderStyle = "thin";
const mkBorder = (color = "C8D0DC") => ({
    top: { style: BORDER_STYLE, color: { rgb: color } },
    bottom: { style: BORDER_STYLE, color: { rgb: color } },
    left: { style: BORDER_STYLE, color: { rgb: color } },
    right: { style: BORDER_STYLE, color: { rgb: color } },
});

const mkCell = (value: any, style: any = {}): any => ({ v: value, s: style });

const headerStyle = (bg = HEADER_BG): any => ({
    fill: { fgColor: { rgb: bg } },
    font: { bold: true, color: { rgb: HEADER_FG }, sz: 10, name: "Calibri" },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: mkBorder("3B5B7A"),
});

const dataStyleBase = (bg = "FFFFFF", fg = "1C1C1E"): any => ({
    fill: { fgColor: { rgb: bg } },
    font: { color: { rgb: fg }, sz: 9, name: "Calibri" },
    alignment: { horizontal: "left", vertical: "center" },
    border: mkBorder(),
});

const dataStyleNumber = (bg = "FFFFFF", fg = "1C1C1E"): any => ({
    ...dataStyleBase(bg, fg),
    alignment: { horizontal: "right", vertical: "center" },
    numFmt: "#,##0",
});

// Paleta de estado de rotación
const statusStyle = (status: string): any => {
    if (status === "ROTACIÓN ACTIVA")  return { fill: { fgColor: { rgb: "D1FAE5" } }, font: { bold: true, color: { rgb: "065F46" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" }, border: mkBorder("6EE7B7") };
    if (status === "COMPRA URGENTE")   return { fill: { fgColor: { rgb: "FEE2E2" } }, font: { bold: true, color: { rgb: "991B1B" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" }, border: mkBorder("FCA5A5") };
    if (status === "NULA ROTACIÓN")    return { fill: { fgColor: { rgb: "FEF3C7" } }, font: { bold: true, color: { rgb: "92400E" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" }, border: mkBorder("FCD34D") };
    if (status === "SIN MOVIMIENTO")   return { fill: { fgColor: { rgb: "F1F5F9" } }, font: { bold: false, color: { rgb: "94A3B8" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" }, border: mkBorder() };
    return dataStyleBase();
};

// Paleta para tipo de alerta
const alertTypeStyle = (tipo: string): any => {
    if (tipo === "COMPRA")   return { fill: { fgColor: { rgb: "FEE2E2" } }, font: { bold: true, color: { rgb: "B91C1C" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" }, border: mkBorder("FCA5A5") };
    if (tipo === "TRASPASO") return { fill: { fgColor: { rgb: "DBEAFE" } }, font: { bold: true, color: { rgb: "1E40AF" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "center", vertical: "center" }, border: mkBorder("93C5FD") };
    return dataStyleBase();
};

// Paleta para valor de stock numérico
const stockNumStyle = (val: number, isEven: boolean): any => {
    const rowBg = isEven ? "F8FAFC" : "FFFFFF";
    if (val <= 0)          return { fill: { fgColor: { rgb: "FEE2E2" } }, font: { bold: true, color: { rgb: "B91C1C" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "right", vertical: "center" }, border: mkBorder("FCA5A5"), numFmt: "#,##0" };
    if (val <= STOCK_BAJO) return { fill: { fgColor: { rgb: "FEF3C7" } }, font: { bold: true, color: { rgb: "92400E" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "right", vertical: "center" }, border: mkBorder("FCD34D"), numFmt: "#,##0" };
    return { fill: { fgColor: { rgb: "D1FAE5" } }, font: { bold: true, color: { rgb: "065F46" }, sz: 9, name: "Calibri" }, alignment: { horizontal: "right", vertical: "center" }, border: mkBorder("6EE7B7"), numFmt: "#,##0" };
};

const colLetter = (idx: number): string => {
    let letter = "";
    idx += 1;
    while (idx > 0) {
        const rem = (idx - 1) % 26;
        letter = String.fromCharCode(65 + rem) + letter;
        idx = Math.floor((idx - 1) / 26);
    }
    return letter;
};

export const exportToExcel = (dataToExport: any[], filename: string, columnsToKeep?: string[]) => {
    if (!dataToExport || dataToExport.length === 0) return;

    // 1. Filtrar columnas
    const keys: string[] = columnsToKeep && columnsToKeep.length > 0
        ? columnsToKeep
        : Object.keys(dataToExport[0] || {});

    const finalData = dataToExport.map(row => {
        const newRow: Record<string, any> = {};
        keys.forEach(col => { newRow[col] = row[col] !== undefined ? row[col] : ""; });
        return newRow;
    });

    // Detectar si es una exportación de Alertas o Inventario
    const isAlertas = keys.some(k => k === "Tipo de Alerta" || k === "Origen" || k === "Destino / Sucursal");

    // 2. Construir la hoja con celdas estilizadas manualmente
    const wb = XLSXStyle.utils.book_new();
    const wsData: any[][] = [];

    // ── FILA 0: TÍTULO GRANDE ──────────────────────────────────────────────
    const titleText = isAlertas ? "REPORTE DE ALERTAS Y SUGERENCIAS" : "REPORTE DE INVENTARIO MAESTRO";
    const titleRow: any[] = [mkCell(titleText, {
        fill: { fgColor: { rgb: BRAND_BLUE } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14, name: "Calibri" },
        alignment: { horizontal: "center", vertical: "center" },
        border: mkBorder("1A3A5C"),
    })];
    // Celdas vacías para el merge
    for (let i = 1; i < keys.length; i++) titleRow.push(mkCell("", { fill: { fgColor: { rgb: BRAND_BLUE } }, border: mkBorder("1A3A5C") }));
    wsData.push(titleRow);

    // ── FILA 1: METADATOS ─────────────────────────────────────────────────
    const now = new Date();
    const metaText = `Generado: ${now.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}  |  Total de registros: ${finalData.length}`;
    const metaRow: any[] = [mkCell(metaText, {
        fill: { fgColor: { rgb: SECTION_BG } },
        font: { italic: true, color: { rgb: "334155" }, sz: 9, name: "Calibri" },
        alignment: { horizontal: "left", vertical: "center" },
        border: mkBorder("CBD5E1"),
    })];
    for (let i = 1; i < keys.length; i++) metaRow.push(mkCell("", { fill: { fgColor: { rgb: SECTION_BG } }, border: mkBorder("CBD5E1") }));
    wsData.push(metaRow);

    // ── FILA 2: ENCABEZADOS ────────────────────────────────────────────────
    const headerRow: any[] = keys.map(k => mkCell(k.toUpperCase(), headerStyle()));
    wsData.push(headerRow);

    // ── FILAS DE DATOS ────────────────────────────────────────────────────
    finalData.forEach((row, rowIdx) => {
        const isEven = rowIdx % 2 === 0;
        const rowBg = isEven ? "F8FAFC" : "FFFFFF";

        const dataRow: any[] = keys.map(col => {
            const val = row[col];
            const strVal = String(val ?? "");

            // — Tipo de Alerta (columna especial)
            if (col === "Tipo de Alerta") {
                return mkCell(val, alertTypeStyle(strVal));
            }

            // — Estado de Rotación
            if (col === "Estado_Rotacion" || col.startsWith("Rotacion_")) {
                return mkCell(val, statusStyle(strVal));
            }

            // — Columna Cantidad en Alertas
            if (col === "Cantidad") {
                const numVal = typeof val === "number" ? val : parseFloat(strVal);
                if (!isNaN(numVal) && strVal !== "REVISAR") {
                    return mkCell(numVal, { ...dataStyleNumber(rowBg), font: { bold: true, color: { rgb: "1E40AF" }, sz: 9, name: "Calibri" } });
                }
                return mkCell(val ?? "", {
                    fill: { fgColor: { rgb: "FEF3C7" } },
                    font: { bold: true, color: { rgb: "92400E" }, sz: 9, name: "Calibri" },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: mkBorder(),
                });
            }

            // — Columnas numéricas de stock (sucursales / Exist / Ventas)
            if (typeof val === "number" || (!isNaN(parseFloat(strVal)) && strVal !== "" && col !== "Clave" && col !== "clave")) {
                const numVal = typeof val === "number" ? val : parseFloat(strVal);
                const isSucursalCol = SUCURSALES.some(s => col.toUpperCase().startsWith(s) || col.toUpperCase() === s);
                const isExistCol = col === "Exist" || col === "exist" || col === "Ventas_Global";

                if (isSucursalCol && !col.startsWith("Rotacion_")) {
                    return mkCell(numVal, stockNumStyle(numVal, isEven));
                }
                if (isExistCol) {
                    return mkCell(numVal, stockNumStyle(numVal, isEven));
                }
                return mkCell(numVal, dataStyleNumber(rowBg));
            }

            // — Clave (resaltada levemente)
            if (col === "Clave" || col === "clave") {
                return mkCell(val ?? "", {
                    fill: { fgColor: { rgb: rowBg } },
                    font: { bold: true, color: { rgb: BRAND_BLUE_LIGHT }, sz: 9, name: "Calibri" },
                    alignment: { horizontal: "left", vertical: "center" },
                    border: mkBorder(),
                });
            }

            // — Origen / Destino en Alertas
            if (col === "Origen") {
                return mkCell(val ?? "", {
                    fill: { fgColor: { rgb: rowBg } },
                    font: { color: { rgb: "475569" }, sz: 9, name: "Calibri" },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: mkBorder(),
                });
            }
            if (col === "Destino / Sucursal") {
                return mkCell(val ?? "", {
                    fill: { fgColor: { rgb: "EFF6FF" } },
                    font: { bold: true, color: { rgb: "1D4ED8" }, sz: 9, name: "Calibri" },
                    alignment: { horizontal: "center", vertical: "center" },
                    border: mkBorder("BFDBFE"),
                });
            }

            // — Celda genérica
            return mkCell(val ?? "", dataStyleBase(rowBg));
        });

        wsData.push(dataRow);
    });

    // ── FILA TOTALES (SUM) ────────────────────────────────────────────────
    const TOTAL_BG = "0F2B4A";
    const totalLabelStyle: any = {
        fill: { fgColor: { rgb: TOTAL_BG } },
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
        alignment: { horizontal: "center", vertical: "center" },
        border: mkBorder("3B5B7A"),
    };
    const totalSumStyle: any = {
        fill: { fgColor: { rgb: TOTAL_BG } },
        font: { bold: true, color: { rgb: "FFD700" }, sz: 10, name: "Calibri" },
        alignment: { horizontal: "right", vertical: "center" },
        border: mkBorder("3B5B7A"),
        numFmt: "#,##0",
    };

    // Fila de Excel donde comienzan los datos (1-indexed): 1=título, 2=meta, 3=header, 4=datos
    const dataExcelStartRow = 4;
    const dataExcelEndRow = 3 + finalData.length;

    // Detectar cuáles columnas son numéricas (tienen al menos 1 número real)
    const numericColsSet = new Set<string>();
    finalData.forEach(row => {
        keys.forEach(k => {
            const v = row[k];
            if (typeof v === "number" && !isNaN(v)) numericColsSet.add(k);
            else if (typeof v === "string" && !isNaN(parseFloat(v)) && v.trim() !== "" && k !== "Clave" && k !== "clave") numericColsSet.add(k);
        });
    });

    const totalsRow: any[] = keys.map((col, colIdx) => {
        if (colIdx === 0) return mkCell("TOTALES", totalLabelStyle);
        if (numericColsSet.has(col) && col !== "Clave" && col !== "clave") {
            const colAddr = colLetter(colIdx);
            return {
                f: `SUM(${colAddr}${dataExcelStartRow}:${colAddr}${dataExcelEndRow})`,
                s: totalSumStyle,
            };
        }
        return mkCell("", totalLabelStyle);
    });
    wsData.push(totalsRow);

    // 3. Convertir array de arrays a worksheet
    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

    // 4. Merges para título y metadatos
    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: keys.length - 1 } }, // título
        { s: { r: 1, c: 0 }, e: { r: 1, c: keys.length - 1 } }, // metadatos
    ];

    // 5. Alto de filas especiales
    ws["!rows"] = [
        { hpt: 30 }, // título
        { hpt: 18 }, // metadatos
        { hpt: 24 }, // encabezados
    ];

    // 6. Ancho de columnas auto-calculado
    ws["!cols"] = keys.map(key => {
        let max = key.length;
        finalData.forEach(row => {
            const v = row[key];
            if (v !== undefined && v !== null) {
                const len = String(v).length;
                if (len > max) max = len;
            }
        });
        // Columnas especiales más anchas
        if (key === "Artículo" || key === "Producto") return { wch: Math.min(max + 2, 45) };
        return { wch: Math.min(max + 2, 30) };
    });

    // 7. AutoFilter en la fila de encabezados (row 3 = índice 2)
    const lastCol = colLetter(keys.length - 1);
    ws["!autofilter"] = { ref: `A3:${lastCol}3` };

    // 8. Freeze pane: congelar las 3 primeras filas (título + meta + headers)
    ws["!freeze"] = { xSplit: 0, ySplit: 3 };

    // 9. Escribir el archivo
    XLSXStyle.utils.book_append_sheet(wb, ws, isAlertas ? "Alertas" : "Inventario");
    XLSXStyle.writeFile(wb, filename);
};


// =========================================================================
// NUEVA LÓGICA: CRUCE DE VENTAS Y EXISTENCIAS (Reglas Exactas de la Clienta)
// =========================================================================

// Normaliza nombres de sucursal de forma flexible
export const normSucursal = (nombre: string): string => {
    if (!nombre) return "";
    let limpio = String(nombre).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
        .replace(/sucursal|suc\.?|farmacia|almacen|almacén|bodega/g, "")
        .replace(/[^a-z0-9]/g, " ")
        .trim();

    if (limpio.includes("abasto")) return "ABASTOS";
    if (limpio.includes("atzompa")) return "ATZOMPA";
    if (limpio.includes("casa")) return "CASAS";
    if (limpio.includes("centro")) return "CENTRO";
    if (limpio.includes("etla")) return "ETLA";
    if (limpio.includes("matriz")) return "MATRIZ";
    if (limpio.includes("moll") || limpio.includes("plaza bella")) return "MOLL";
    if (limpio.includes("reforma")) return "REFORMA";
    if (limpio.includes("rosario")) return "ROSARIO";
    if ((limpio.includes("santa") && limpio.includes("rosa")) || limpio === "santarosa") return "SANTA ROSA";
    if (limpio.includes("telix")) return "TELIX";
    if (limpio.includes("tlacolula")) return "TLACOLULA";
    if (limpio.includes("torre") || limpio.includes("medica")) return "TORRE MEDICA";
    if (limpio === "va" || limpio.startsWith("va ")) return "VA";
    if (limpio.includes("viguera")) return "VIGUERA";
    if (limpio.includes("xoxo")) return "XOXO";

    return limpio.toUpperCase();
};

const cleanClave = (val: any): string => {
    if (val === undefined || val === null) return "";
    let c = String(val).trim().toUpperCase();
    if (c.endsWith(".0") && !isNaN(Number(c.slice(0, -2)))) {
        c = c.slice(0, -2);
    }
    return c;
};

// --- Reglas de lectura compartidas entre el cálculo y la revisión previa de archivos ---

const RE_CLAVE = /^(clave|codigo|código|cod|cve|articulo_id)$/i;
const RE_ARTICULO = /^(articulo|artículo|articulos|artículos|descripcion|descripción|producto)$/i;
const RE_SUCURSAL = /^(sucursal|tienda|almacen|almacén|bodega|suc)$/i;
const RE_TOTAL = /^(total|cantidad|cant|unidades|piezas|venta|ventas)$/i;

const SUCURSALES_UP = SUCURSALES.map((s) => s.toUpperCase());

const colClaveExistencias = (keys: string[]) =>
    keys.find((k) => RE_CLAVE.test(k.trim())) || keys.find((k) => k.toLowerCase().includes("clave"));
const colArticuloExistencias = (keys: string[]) =>
    keys.find((k) => RE_ARTICULO.test(k.trim())) || keys.find((k) => k.toLowerCase().includes("articulo"));
const colClaveVentas = (keys: string[]) => keys.find((k) => RE_CLAVE.test(k.trim()));
const colSucursalVentas = (keys: string[]) => keys.find((k) => RE_SUCURSAL.test(k.trim()));
const colTotalVentas = (keys: string[]) => keys.find((k) => RE_TOTAL.test(k.trim()));
const colMes = (keys: string[], mes: string) => keys.find((k) => k.trim().toUpperCase().startsWith(mes));

const esClaveIgnoradaExistencias = (clave: string) =>
    !clave || clave === "000XXX" || clave.toLowerCase().includes("clave");
const esClaveIgnoradaVentas = (clave: string) => !clave || clave === "000XXX";

const COLUMNAS_EXISTENCIA_GENERAL = ["general", "total", "existencia", "existencias", "existencia general", "exist"];

const aNumero = (v: any): number => parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")) || 0;

// Total de una fila de ventas: usa la columna de total si existe, si no suma los meses
const totalFilaVentas = (row: any, keys: string[]): number => {
    const totalKey = colTotalVentas(keys);
    if (totalKey && row[totalKey] !== undefined && row[totalKey] !== null && String(row[totalKey]).trim() !== "") {
        return aNumero(row[totalKey]);
    }
    let total = 0;
    MESES.forEach((m) => {
        const mKey = colMes(keys, m);
        if (mKey && row[mKey] !== undefined && row[mKey] !== null) total += aNumero(row[mKey]);
    });
    return total;
};

const leerPrimeraHoja = async (file: File): Promise<any[]> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]) as any[];
};

// =========================================================================
// REVISIÓN PREVIA DE ARCHIVOS (antes de calcular)
// =========================================================================

export interface ResumenExistencias {
    filas: number;
    filasConProducto: number;
    filasRelleno: number;
    sucursales: string[];
    claves: Set<string>;
    errores: string[];
    avisos: string[];
}

export interface ResumenVentas {
    filas: number;
    productos: number;
    meses: string[];
    sucursales: string[]; // sucursales con ventas > 0
    sucursalesNoReconocidas: string[];
    claves: Set<string>;
    errores: string[];
    avisos: string[];
}

const unirColumnas = (rows: any[]): string[] => {
    const set = new Set<string>();
    rows.forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    return Array.from(set);
};

const sucursalesEnEncabezados = (keys: string[]): string[] => {
    const set = new Set<string>();
    keys.forEach((k) => {
        const n = normSucursal(k);
        if (SUCURSALES_UP.includes(n)) set.add(n);
    });
    return Array.from(set);
};

export const inspeccionarExistencias = async (file: File): Promise<ResumenExistencias> => {
    const rows = await leerPrimeraHoja(file);
    const resumen: ResumenExistencias = {
        filas: rows.length,
        filasConProducto: 0,
        filasRelleno: 0,
        sucursales: [],
        claves: new Set(),
        errores: [],
        avisos: [],
    };
    if (rows.length === 0) {
        resumen.errores.push("El archivo está vacío.");
        return resumen;
    }

    const keys = unirColumnas(rows);
    const claveKey = colClaveExistencias(keys);
    const articuloKey = colArticuloExistencias(keys);
    resumen.sucursales = sucursalesEnEncabezados(keys).sort();

    const pareceVentas = !!colSucursalVentas(keys) && (!!colTotalVentas(keys) || MESES.some((m) => colMes(keys, m)));
    if (pareceVentas && resumen.sucursales.length < 3) {
        resumen.errores.push("Este archivo parece ser de ventas. Súbelo en la tarjeta 2 (Ventas) y aquí elige el de existencias.");
        return resumen;
    }

    if (!claveKey) resumen.errores.push("Falta la columna Clave.");
    if (!articuloKey) resumen.errores.push("Falta la columna Artículo (o Artículos, Descripción).");
    if (resumen.sucursales.length === 0) {
        resumen.errores.push("No encontramos columnas con nombres de sucursales (Moll, Reforma, Matriz, etc.).");
    }
    if (resumen.errores.length > 0) return resumen;

    rows.forEach((row) => {
        const clave = cleanClave(row[claveKey!]);
        if (esClaveIgnoradaExistencias(clave)) {
            resumen.filasRelleno++;
            return;
        }
        resumen.filasConProducto++;
        resumen.claves.add(clave);
    });

    if (resumen.filasConProducto === 0) resumen.errores.push("No encontramos productos en el archivo.");

    const faltantes = SUCURSALES_UP.filter((s) => !resumen.sucursales.includes(s));
    if (faltantes.length > 0 && resumen.errores.length === 0) {
        resumen.avisos.push(
            `No encontramos columnas para: ${faltantes.join(", ")}. Esas sucursales no tendrán existencia.`
        );
    }
    return resumen;
};

export const inspeccionarVentas = async (file: File): Promise<ResumenVentas> => {
    const rows = await leerPrimeraHoja(file);
    const resumen: ResumenVentas = {
        filas: rows.length,
        productos: 0,
        meses: [],
        sucursales: [],
        sucursalesNoReconocidas: [],
        claves: new Set(),
        errores: [],
        avisos: [],
    };
    if (rows.length === 0) {
        resumen.errores.push("El archivo está vacío.");
        return resumen;
    }

    const keys = unirColumnas(rows);
    const claveKey = colClaveVentas(keys);
    const sucKey = colSucursalVentas(keys);
    const tieneTotal = !!colTotalVentas(keys);
    resumen.meses = MESES.filter((m) => colMes(keys, m));

    if (!sucKey && sucursalesEnEncabezados(keys).length >= 3) {
        resumen.errores.push("Este archivo parece ser de existencias. Súbelo en la tarjeta 1 (Existencias) y aquí elige el de ventas.");
        return resumen;
    }

    if (!claveKey) resumen.errores.push("Falta la columna Clave.");
    if (!sucKey) resumen.errores.push("Falta la columna Sucursal.");
    if (!tieneTotal && resumen.meses.length === 0) {
        resumen.errores.push("No encontramos las columnas de meses (ENE, FEB, MAR…) ni una columna de total.");
    }
    if (resumen.errores.length > 0) return resumen;

    const conVentas = new Set<string>();
    const noReconocidas = new Set<string>();
    rows.forEach((row) => {
        const clave = cleanClave(row[claveKey!]);
        if (esClaveIgnoradaVentas(clave)) return;
        resumen.claves.add(clave);
        const suc = normSucursal(String(row[sucKey!] ?? ""));
        if (!suc) return;
        if (!SUCURSALES_UP.includes(suc)) {
            noReconocidas.add(String(row[sucKey!]).trim());
            return;
        }
        if (totalFilaVentas(row, keys) > 0) conVentas.add(suc);
    });

    resumen.productos = resumen.claves.size;
    resumen.sucursales = Array.from(conVentas).sort();
    resumen.sucursalesNoReconocidas = Array.from(noReconocidas);

    if (resumen.productos === 0) resumen.errores.push("No encontramos productos en el archivo.");
    if (resumen.sucursalesNoReconocidas.length > 0) {
        resumen.avisos.push(
            `No reconocimos estas sucursales y sus ventas no se asignarán a ninguna: ${resumen.sucursalesNoReconocidas.join(", ")}.`
        );
    }
    return resumen;
};

/** Avisos y errores que salen de comparar los dos archivos */
export const revisarCruce = (
    ex: ResumenExistencias,
    vt: ResumenVentas
): { errores: string[]; avisos: string[] } => {
    const errores: string[] = [];
    const avisos: string[] = [];
    if (ex.errores.length > 0 || vt.errores.length > 0) return { errores, avisos };

    const sinVentas = ex.sucursales.filter((s) => !vt.sucursales.includes(s));
    if (sinVentas.length > 0) {
        const lista = sinVentas.join(", ");
        avisos.push(
            sinVentas.length === 1
                ? `${lista} no aparece en el archivo de ventas: sus productos con existencia se marcarán como nula rotación.`
                : `${lista} no aparecen en el archivo de ventas: sus productos con existencia se marcarán como nula rotación.`
        );
    }

    let enComun = 0;
    vt.claves.forEach((c) => {
        if (ex.claves.has(c)) enComun++;
    });
    if (vt.claves.size > 0 && enComun === 0) {
        errores.push("Los dos archivos no comparten ningún producto. Revisa que sean del mismo catálogo.");
    } else if (vt.claves.size > 0 && enComun / vt.claves.size < 0.5) {
        avisos.push(
            `Solo ${enComun.toLocaleString()} de ${vt.claves.size.toLocaleString()} productos con ventas aparecen en existencias. Revisa que sean del mismo catálogo.`
        );
    }
    return { errores, avisos };
};

// =========================================================================
// CÁLCULO DE ROTACIÓN Y ALERTAS (función pura, se usa al cargar y al actualizar)
// =========================================================================

/**
 * A partir de existencias por sucursal (`sucursales`), existencia global (`exist`) y ventas por
 * sucursal (`ventasPorSucursal`) de cada producto, calcula los estados de rotación y las alertas.
 * No modifica las filas que recibe: devuelve filas nuevas.
 */
export const recalcularRotacionYAlertas = (rows: MasterRow[]): { data: MasterRow[]; alertas: Alert[] } => {
    const alertas: Alert[] = [];

    const data = rows.map((row) => {
        const ventas = row.ventasPorSucursal || {};
        const { clave, articulo, exist } = row;

        // Ventas totales y sucursal que más vende
        let totalGlobal = 0;
        let maxVentas = 0;
        let maxSucursal = "";
        Object.keys(ventas).forEach((s) => {
            const v = ventas[s] || 0;
            totalGlobal += v;
            if (v > maxVentas) {
                maxVentas = v;
                maxSucursal = s;
            }
        });

        const raw: Record<string, any> = {
            ...row.raw,
            Clave: clave,
            Artículo: articulo,
            Ventas_Global: totalGlobal,
        };

        Object.keys(row.sucursales).forEach((sucNorm) => {
            const val = row.sucursales[sucNorm];
            raw[sucNorm] = val; // el stock va en la columna para que la tabla pinte colores
            const ventaEnEstaSucursal = ventas[sucNorm] || 0;

            // Nula rotación: hay existencia aquí, no se vende aquí, y otra sucursal sí lo vende -> traspaso
            if (val > 0 && ventaEnEstaSucursal === 0 && maxVentas > 0 && maxSucursal !== sucNorm) {
                alertas.push({
                    tipo: "TRASPASO",
                    producto: articulo,
                    clave,
                    origen: sucNorm, // de la sucursal que no lo vende
                    destino: maxSucursal, // a la que más lo vende
                    cantidad: val, // el stock estancado
                });
            }

            // Estado de rotación individual por sucursal
            if (val <= 0 && ventaEnEstaSucursal > 0) {
                raw[`Rotacion_${sucNorm}`] = "COMPRA URGENTE";
            } else if (val > 0 && ventaEnEstaSucursal === 0) {
                raw[`Rotacion_${sucNorm}`] = "NULA ROTACIÓN";
            } else if (val === 0 && ventaEnEstaSucursal === 0) {
                raw[`Rotacion_${sucNorm}`] = "SIN MOVIMIENTO";
            } else {
                raw[`Rotacion_${sucNorm}`] = "ROTACIÓN ACTIVA";
            }
        });

        // Estado global y regla de compra (se vende pero no hay existencia)
        if (exist <= 0 && totalGlobal > 0) {
            const sucursalesConVenta = Object.keys(ventas).filter((s) => (ventas[s] || 0) > 0);
            const destinoStr =
                sucursalesConVenta.length === 1
                    ? sucursalesConVenta[0]
                    : sucursalesConVenta.length > 0
                      ? sucursalesConVenta.join(", ")
                      : "VARIAS";

            alertas.push({
                tipo: "COMPRA",
                producto: articulo,
                clave,
                origen: "PROVEEDOR",
                destino: destinoStr,
                // Cantidad sugerida = total de ventas del período (reposición completa)
                cantidad: Math.max(1, Math.ceil(totalGlobal)),
                sucursales: sucursalesConVenta,
            });
            raw["Estado_Rotacion"] = "COMPRA URGENTE";
        } else if (exist > 0 && totalGlobal === 0) {
            raw["Estado_Rotacion"] = "NULA ROTACIÓN";
        } else if (exist <= 0 && totalGlobal === 0) {
            raw["Estado_Rotacion"] = "SIN MOVIMIENTO"; // ni hay existencia ni se vende
        } else {
            raw["Estado_Rotacion"] = "ROTACIÓN ACTIVA";
        }
        raw["Exist"] = exist;

        return { ...row, raw };
    });

    return { data, alertas };
};

// Suma las ventas de un archivo por clave y sucursal.
// Si se da `sucursalFija`, el archivo se asigna a esa sucursal (y si trae columna de sucursal, solo cuentan sus filas).
const agruparVentas = (
    rows: any[],
    sucursalFija?: string
): { porClave: Record<string, Record<string, number>>; filasUsadas: number } => {
    const porClave: Record<string, Record<string, number>> = {};
    let filasUsadas = 0;

    rows.forEach((row) => {
        const keys = Object.keys(row);
        const claveKey = colClaveVentas(keys);
        const clave = cleanClave(claveKey ? row[claveKey] : "");
        if (esClaveIgnoradaVentas(clave)) return;

        const sucursalKey = colSucursalVentas(keys);
        const sucursalFila = normSucursal(String((sucursalKey ? row[sucursalKey] : "") || ""));
        if (sucursalFija && sucursalKey && sucursalFila !== sucursalFija) return;
        const sucursal = sucursalFija || sucursalFila;

        const total = totalFilaVentas(row, keys);
        if (!porClave[clave]) porClave[clave] = {};
        porClave[clave][sucursal] = (porClave[clave][sucursal] || 0) + total;
        filasUsadas++;
    });

    return { porClave, filasUsadas };
};

export const procesarRotacionCruzada = async (
    fileVentas: File,
    fileExistencias: File
): Promise<{ data: MasterRow[]; alertas: Alert[]; rawColumns: string[] }> => {
    // 1. Leer Ventas
    const { porClave: ventasPorClave } = agruparVentas(await leerPrimeraHoja(fileVentas));

    // 2. Leer Existencias
    const rawExist = await leerPrimeraHoja(fileExistencias);

    const productosList: MasterRow[] = [];

    // Columnas que enviaremos a la tabla
    const rawColumns = ["Clave", "Artículo", "Exist", "Ventas_Global", "Estado_Rotacion", ...SUCURSALES.map((s) => s.toUpperCase())];
    SUCURSALES.forEach((s) => rawColumns.push(`Rotacion_${s.toUpperCase()}`));

    rawExist.forEach((row) => {
        const keysRow = Object.keys(row);
        const claveKey = colClaveExistencias(keysRow);
        const articuloKey = colArticuloExistencias(keysRow);
        if (!claveKey || !articuloKey) return;

        const clave = cleanClave(row[claveKey]);
        const articulo = String(row[articuloKey]).trim();
        if (esClaveIgnoradaExistencias(clave)) return;

        let existGlobal = 0;
        const stockSucursales: Record<string, number> = {};

        keysRow.forEach((k) => {
            const col = k.toLowerCase().trim();
            const val = aNumero(row[k]);
            if (COLUMNAS_EXISTENCIA_GENERAL.includes(col)) {
                existGlobal = val;
            } else {
                const sucNorm = normSucursal(k);
                if (SUCURSALES_UP.includes(sucNorm)) stockSucursales[sucNorm] = val;
            }
        });

        if (existGlobal === 0) {
            existGlobal = Object.values(stockSucursales).reduce((a, b) => a + b, 0);
        }

        productosList.push({
            clave,
            articulo,
            exist: existGlobal,
            sucursales: stockSucursales,
            ventasPorSucursal: { ...(ventasPorClave[clave] || {}) },
            raw: {},
        });
    });

    const { data, alertas } = recalcularRotacionYAlertas(productosList);
    return { data, alertas, rawColumns };
};

// =========================================================================
// ACTUALIZAR SIN EMPEZAR DE CERO
// =========================================================================

export interface ResultadoActualizacion {
    data: MasterRow[];
    alertas: Alert[];
    actualizados: number; // productos que cambiaron
    noEncontradas: string[]; // claves del archivo que no están en los datos cargados
}

/** Actualiza las existencias de los productos ya cargados. `sucursal` es "TODAS" o el nombre normalizado de una sucursal. */
export const actualizarExistencias = async (
    file: File,
    master: MasterRow[],
    sucursal: string
): Promise<ResultadoActualizacion> => {
    const rows = await leerPrimeraHoja(file);
    if (rows.length === 0) throw new Error("El archivo está vacío.");
    const keys = unirColumnas(rows);

    const claveKey = colClaveExistencias(keys);
    if (!claveKey) throw new Error("Falta la columna Clave.");

    // Columnas de existencia a leer: [sucursal normalizada, columna del archivo]
    const columnas: [string, string][] = [];
    let colGeneral: string | undefined;
    if (sucursal === "TODAS") {
        keys.forEach((k) => {
            const n = normSucursal(k);
            if (SUCURSALES_UP.includes(n)) columnas.push([n, k]);
        });
        colGeneral = keys.find((k) => COLUMNAS_EXISTENCIA_GENERAL.includes(k.toLowerCase().trim()));
        if (columnas.length === 0) throw new Error("No encontramos columnas de sucursales en este archivo.");
    } else {
        const col =
            keys.find((k) => normSucursal(k) === sucursal) ||
            keys.find((k) => COLUMNAS_EXISTENCIA_GENERAL.includes(k.toLowerCase().trim()));
        if (!col) throw new Error("No encontramos la columna de existencia (Existencia, General o Total).");
        columnas.push([sucursal, col]);
    }

    const nuevos: Record<string, any> = {};
    rows.forEach((row) => {
        const clave = cleanClave(row[claveKey]);
        if (!esClaveIgnoradaExistencias(clave)) nuevos[clave] = row;
    });

    const enMaster = new Set<string>();
    let actualizados = 0;
    const nuevoMaster = master.map((p) => {
        enMaster.add(p.clave);
        const fila = nuevos[p.clave];
        if (!fila) return p;

        const sucursales = { ...p.sucursales };
        columnas.forEach(([suc, col]) => {
            sucursales[suc] = aNumero(fila[col]);
        });

        let exist: number;
        if (sucursal === "TODAS") {
            const general = colGeneral ? aNumero(fila[colGeneral]) : 0;
            exist = general !== 0 ? general : Object.values(sucursales).reduce((a, b) => a + b, 0);
        } else {
            // Solo cambió una sucursal: ajustamos la existencia global por la diferencia
            exist = Math.max(0, p.exist + (sucursales[sucursal] - (p.sucursales[sucursal] || 0)));
        }
        actualizados++;
        return { ...p, sucursales, exist };
    });

    const noEncontradas = Object.keys(nuevos).filter((c) => !enMaster.has(c));
    const { data, alertas } = recalcularRotacionYAlertas(nuevoMaster);
    return { data, alertas, actualizados, noEncontradas };
};

/** Suma las ventas de un archivo a los datos cargados. `sucursal` es "TODAS" o el nombre normalizado de una sucursal. */
export const sumarVentas = async (
    file: File,
    master: MasterRow[],
    sucursal: string
): Promise<ResultadoActualizacion> => {
    const rows = await leerPrimeraHoja(file);
    if (rows.length === 0) throw new Error("El archivo está vacío.");
    const keys = unirColumnas(rows);

    if (!colClaveVentas(keys)) throw new Error("Falta la columna Clave.");
    if (sucursal === "TODAS" && !colSucursalVentas(keys)) {
        throw new Error("Este archivo no trae columna Sucursal. Elige de qué sucursal es el archivo.");
    }
    if (!colTotalVentas(keys) && !MESES.some((m) => colMes(keys, m))) {
        throw new Error("No encontramos las columnas de meses (ENE, FEB, MAR…) ni una columna de total.");
    }

    const { porClave, filasUsadas } = agruparVentas(rows, sucursal === "TODAS" ? undefined : sucursal);
    if (filasUsadas === 0) throw new Error("No encontramos ventas de esa sucursal en el archivo.");

    const enMaster = new Set<string>();
    let actualizados = 0;
    const nuevoMaster = master.map((p) => {
        enMaster.add(p.clave);
        const nuevas = porClave[p.clave];
        if (!nuevas) return p;
        const ventasPorSucursal = { ...p.ventasPorSucursal };
        Object.keys(nuevas).forEach((s) => {
            ventasPorSucursal[s] = (ventasPorSucursal[s] || 0) + nuevas[s];
        });
        actualizados++;
        return { ...p, ventasPorSucursal };
    });

    const noEncontradas = Object.keys(porClave).filter((c) => !enMaster.has(c));
    const { data, alertas } = recalcularRotacionYAlertas(nuevoMaster);
    return { data, alertas, actualizados, noEncontradas };
};

/** Descarga un Excel sencillo con las claves que no se encontraron */
export const descargarClavesNoEncontradas = (claves: string[], nombreArchivo: string) => {
    const ws = XLSX.utils.aoa_to_sheet([["Clave"], ...claves.map((c) => [c])]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Claves no encontradas");
    XLSX.writeFile(wb, nombreArchivo);
};

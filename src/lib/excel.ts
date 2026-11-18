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

export const procesarRotacionCruzada = async (
    fileVentas: File,
    fileExistencias: File
): Promise<{ data: MasterRow[]; alertas: Alert[]; rawColumns: string[] }> => {

    // 1. Leer Ventas
    const rawVentas = await leerPrimeraHoja(fileVentas);

    // clave -> { maxSucursal: "", maxVentas: 0, totalGlobal: 0, sucursales: { "ABASTOS": 10 } }
    const diccionarioVentas: Record<string, any> = {};

    rawVentas.forEach((row) => {
        const keys = Object.keys(row);
        const claveKey = colClaveVentas(keys);
        const clave = cleanClave(claveKey ? row[claveKey] : "");
        if (esClaveIgnoradaVentas(clave)) return;

        const sucursalKey = colSucursalVentas(keys);
        const sucursal = normSucursal(String((sucursalKey ? row[sucursalKey] : "") || ""));

        // Total de la fila: columna de total o suma de meses
        const total = totalFilaVentas(row, keys);

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
    const rawExist = await leerPrimeraHoja(fileExistencias);

    const productosList: MasterRow[] = [];
    const alertasGeneradas: Alert[] = [];

    // Columnas que enviaremos a la tabla
    const rawColumns = ["Clave", "Artículo", "Exist", "Ventas_Global", "Estado_Rotacion", ...SUCURSALES.map(s => s.toUpperCase())];

    // PARA ASEGURAR QUE SE EXPORTEN LAS ROTACIONES:
    SUCURSALES.forEach(s => rawColumns.push(`Rotacion_${s.toUpperCase()}`));

    rawExist.forEach((row) => {
        // Buscar llaves correctas independientemente de espacios
        const keysRow = Object.keys(row);
        const claveKey = colClaveExistencias(keysRow);
        const articuloKey = colArticuloExistencias(keysRow);

        if (!claveKey || !articuloKey) return;

        const clave = cleanClave(row[claveKey]);
        const articulo = String(row[articuloKey]).trim();

        if (esClaveIgnoradaExistencias(clave)) return;

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
            const val = parseFloat(String(row[k] ?? "").replace(/[^0-9.-]/g, "")) || 0;

            if (col === "general" || col === "total" || col === "existencia" || col === "existencias" || col === "existencia general" || col === "exist") {
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

                    // ----------------------------------------------------
                    // PUNTO 1: ESTADO DE ROTACIÓN INDIVIDUAL POR SUCURSAL
                    // ----------------------------------------------------
                    if (val <= 0 && ventaEnEstaSucursal > 0) {
                        visualRaw[`Rotacion_${sucNorm}`] = "COMPRA URGENTE";
                    } else if (val > 0 && ventaEnEstaSucursal === 0) {
                        visualRaw[`Rotacion_${sucNorm}`] = "NULA ROTACIÓN";
                    } else if (val === 0 && ventaEnEstaSucursal === 0) {
                        visualRaw[`Rotacion_${sucNorm}`] = "SIN MOVIMIENTO"; // Ni se vende, ni hay stock
                    } else {
                        visualRaw[`Rotacion_${sucNorm}`] = "ROTACIÓN ACTIVA";
                    }
                }
            }
        });

        if (existGlobal === 0) {
            existGlobal = Object.values(stockSucursales).reduce((a, b) => a + b, 0);
        }

        // Regla de Compra (Se vende pero no hay stock)
        if (existGlobal <= 0 && ventasDelProducto.totalGlobal > 0) {
            const sucursalesConVenta = Object.keys(ventasDelProducto.sucursales)
                .filter(s => (ventasDelProducto.sucursales[s] || 0) > 0);

            const destinoStr = sucursalesConVenta.length === 1
                ? sucursalesConVenta[0]
                : (sucursalesConVenta.length > 0 ? sucursalesConVenta.join(", ") : "VARIAS");

            // Cantidad sugerida = total de ventas del período (reposición completa)
            const cantidadSugeridaCruzada: number | "REVISAR" = ventasDelProducto.totalGlobal > 0
                ? Math.max(1, Math.ceil(ventasDelProducto.totalGlobal))
                : "REVISAR";

            alertasGeneradas.push({
                tipo: "COMPRA",
                producto: articulo,
                clave: clave,
                origen: "PROVEEDOR",
                destino: destinoStr,
                cantidad: cantidadSugeridaCruzada,
                sucursales: sucursalesConVenta
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
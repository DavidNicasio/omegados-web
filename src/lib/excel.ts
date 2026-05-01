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
          /todos|maestro|inventario/i.test(n)
        );
        if (!wsName) {
          wsName =
            wb.SheetNames.find((n) => !/leyenda|rotacion|detalle_meses/i.test(n)) ||
            wb.SheetNames[0];
        }

        const rawJson: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsName]);
        if (rawJson.length === 0) throw new Error("El archivo está vacío");

        const rawColumns = Object.keys(rawJson[0]);

        const processedList: MasterRow[] = [];
        const alerts: Alert[] = [];

        // Dynamic keys detector to avoid strict column naming issues
        const getColKey = (keys: string[], patterns: RegExp[]) =>
          keys.find((k) => patterns.some((p) => p.test(String(k).toLowerCase())));

        const colClave = getColKey(rawColumns, [
          /clave/,
          /codigo/,
          /código/,
          /sku/,
          /cod/,
        ]) || rawColumns[0];
        const colArt = getColKey(rawColumns, [/art.culo/, /descripci.n/]);
        const colExist = getColKey(rawColumns, [
          /^exist$/,
          /existe/,
          /exis/,
          /existencia/,
        ]) || "Exist";

        const SUC_UP = SUCURSALES.map((s) => s.toUpperCase());

        const isRotacionFile = rawColumns.some(c => c.toUpperCase().includes(' P1') || c.toUpperCase().includes(' P2') || /\s(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)/i.test(c));

        rawJson.forEach((row) => {
          let clave = String(row[colClave] || "");
          // Skip invalid rows (garbage mapping)
          if (!clave || clave.trim() === "undefined" || clave.trim() === "" || clave.toLowerCase() === "clave")
            return;

          if (clave.endsWith(".0") && !isNaN(Number(clave.slice(0, -2))))
            clave = clave.slice(0, -2);

          const articulo = colArt ? String(row[colArt] || "") : "Sin nombre";

          const sucData: Record<string, number> = {};
          let groupDataBySucTotal: Record<string, number> = {};
          let totalGeneral = 0;

          rawColumns.forEach((key) => {
            const kUp = key.toUpperCase().trim();
            const isSuc = SUC_UP.find((s) => kUp === s || kUp.startsWith(s + " "));

            if (isSuc) {
              const cleanedVal = String(row[key] || "0").replace(/[^0-9.-]/g, "");
              const v = parseFloat(cleanedVal) || 0;
              sucData[key] = v;
              groupDataBySucTotal[isSuc] = (groupDataBySucTotal[isSuc] || 0) + v;
              totalGeneral += v;
            }
          });

          let exist = 0;
          if (row.hasOwnProperty(colExist)) {
              exist = parseFloat(String(row[colExist] || "0").replace(/[^0-9.-]/g, "")) || 0;
          } else {
              exist = totalGeneral;
          }

          processedList.push({
            clave,
            articulo,
            exist,
            sucursales: sucData,
            raw: row,
          });

          // Accurate Alerts Logic (like backend)
          if (isRotacionFile || row.hasOwnProperty(colExist)) {
             // Rotacion mode:
             if (exist <= 0) {
                 alerts.push({ tipo: "COMPRA", producto: articulo, clave, origen: "PROVEEDOR", destino: "ABASTOS", cantidad: "REVISAR" });
             } else if (exist <= STOCK_BAJO) {
                 let highestSuc = ""; let maxH = -1;
                 Object.keys(groupDataBySucTotal).forEach(s => {
                     if (groupDataBySucTotal[s] > maxH) { maxH = groupDataBySucTotal[s]; highestSuc = s; }
                 });
                 if (highestSuc && maxH > 0) {
                     alerts.push({ tipo: "TRASPASO", producto: articulo, clave, origen: highestSuc !== "ABASTOS" ? highestSuc : "MATRIZ", destino: highestSuc !== "ABASTOS" ? "ABASTOS" : highestSuc, cantidad: 2 });
                 }
             }
          } else {
             // Classic mode: each column is current stock
             let necesitados: string[] = [];
             let donadores: {suc: string, cant: number}[] = [];

             Object.keys(groupDataBySucTotal).forEach(suc => {
                 const cant = Math.floor(groupDataBySucTotal[suc]);
                 if (cant <= 0) necesitados.push(suc);
                 else if (cant <= STOCK_BAJO) necesitados.push(suc);
                 else if (cant >= 5) donadores.push({suc, cant});
             });

             if (necesitados.length > 0 && donadores.length > 0) {
                 donadores.sort((a,b) => b.cant - a.cant);
                 alerts.push({
                     tipo: "TRASPASO",
                     producto: articulo,
                     clave,
                     origen: donadores[0].suc,
                     destino: necesitados[0],
                     cantidad: 2
                 });
             } else if (necesitados.length > 0 && donadores.length === 0 && totalGeneral < 5) {
                 alerts.push({
                     tipo: "COMPRA",
                     producto: articulo,
                     clave,
                     origen: "PROVEEDOR",
                     destino: necesitados.length === 1 ? necesitados[0] : "VARIAS",
                     cantidad: "REVISAR"
                 });
             }
          }
        });

        resolve({ data: processedList, alertas: alerts, rawColumns });
      } catch (err: any) {
        reject(err.message || "No se pudo leer el archivo Excel.");
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

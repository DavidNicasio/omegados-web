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
          /todos|rotacion|maestro|inventario/i.test(n)
        );
        if (!wsName) {
          wsName = wb.SheetNames[0];
        }

        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1 }) as any[][];
        if (rows.length < 2) throw new Error("El archivo está vacío o no tiene el formato esperado");

        const header0 = rows[0] || [];
        const header1 = rows[1] || [];

        // Determine if it's MultiIndex by checking if row 1 has months like ENE, FEB, MAR
        const isMultiIndex = header1.some(v => /^(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)$/i.test(String(v || "").trim()));

        let rawColumns: string[] = [];
        let dataStartIndex = 1;

        if (isMultiIndex) {
            dataStartIndex = 2; // Data starts after row 1
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
            // Normal simple header
            rawColumns = header0.map((v, i) => v ? String(v).trim() : `COL_${i}`);
        }

        let colClaveIdx = -1;
        let colArtIdx = -1;
        let colExistIdx = -1;

        // Rename standard columns to avoid issues
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
            // Skip completely empty rows
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
            // In flattened mode, key could be "ABASTOS_ENE"
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

          // Recreate raw object for visualization table with cleaned up structure
          const visualRaw: Record<string, any> = {};
          rawColumns.forEach(c => {
             visualRaw[c] = row[c] ?? "";
          });
          visualRaw["Clave"] = clave;
          visualRaw["Exist"] = exist;

          processedList.push({
            clave,
            articulo,
            exist,
            sucursales: sucData,
            raw: visualRaw,
          });

          // Accurate Alerts Logic (like backend)
          if (isMultiIndex || (row["Exist"] !== undefined && String(row["Exist"]).trim() !== "")) {
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
             } else if (necesitados.length > 0 && donadores.length === 0 && totalGeneral < STOCK_BAJO * SUCURSALES.length) {
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

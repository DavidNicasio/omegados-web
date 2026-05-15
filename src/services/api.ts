// src/services/api.ts

import { Alert, MasterRow } from "../lib/excel";

export interface GlobalInventoryItem {
  id: string;
  sku: string;
  name: string;
  stock: number;
}

export interface TraspasoOrder {
  origen: string;
  destino: string;
  items: {
    sku: string;
    quantity: number;
  }[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://api.example-inventory.com/v1";
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

/**
 * Creates common headers using the env token
 */
const getHeaders = () => {
  return {
    "Content-Type": "application/json",
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
  };
};

/**
 * Simulates network delay for mock endpoints
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retrieves the global inventory from the cloud system
 */
export async function getGlobalInventory(): Promise<ApiResponse<GlobalInventoryItem[]>> {
  try {
    // If no real token, use mock mode
    if (!API_TOKEN) {
      await delay(1000);
      return {
        success: true,
        data: [
          { id: "1", sku: "750123456789", name: "Paracetamol 500mg", stock: 15 },
          { id: "2", sku: "750987654321", name: "Ibuprofeno 400mg", stock: 2 },
        ],
      };
    }

    const response = await fetch(`${API_BASE_URL}/inventory`, {
      method: "GET",
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error en la API: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error: any) {
    console.error("Error obteniendo inventario global:", error);
    return { success: false, error: error.message || "Error desconocido de red" };
  }
}

/**
 * Sends stock updates to the cloud after parsing local Excel 
 */
export async function syncInventoryData(rows: MasterRow[]): Promise<ApiResponse<void>> {
  try {
    if (!API_TOKEN) {
      await delay(2000);
      return { success: true, message: "Inventario sincronizado exitosamente (MOCK MODE)." };
    }

    // Simplificación: Enviar un batch de actualizaciones
    const payload = rows.map((r) => ({
      sku: r.clave,
      name: r.articulo,
      stock: r.exist,
      branches: Object.entries(r.sucursales).map(([branch, qty]) => ({ branch, qty })),
    }));

    const response = await fetch(`${API_BASE_URL}/inventory/sync`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ batch: payload }),
    });

    if (!response.ok) {
        // Parse error message if possible
        let errorMsg = `Error HTTP ${response.status}`;
        try {
            const errBody = await response.json();
            if (errBody.message) errorMsg = errBody.message;
        } catch(e) {}
      throw new Error(errorMsg);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error sincronizando inventario:", error);
    return { success: false, error: error.message || "No se pudo sincronizar el inventario" };
  }
}

/**
 * Creates transfer orders based on alerts 
 */
export async function createTransferOrders(alerts: Alert[]): Promise<ApiResponse<void>> {
  try {
    const transferAlerts = alerts.filter(a => a.tipo === "TRASPASO");
    
    if (transferAlerts.length === 0) {
        return { success: true, message: "No hay traspasos pendientes para enviar." };
    }

    // Group transfers by origen -> destino
    const ordersMap = new Map<string, TraspasoOrder>();
    transferAlerts.forEach(a => {
        const key = `${a.origen}|${a.destino}`;
        if (!ordersMap.has(key)) {
            ordersMap.set(key, { origen: a.origen, destino: a.destino, items: [] });
        }
        const order = ordersMap.get(key)!;
        order.items.push({
            sku: a.clave,
            quantity: typeof a.cantidad === "number" ? a.cantidad : 0
        });
    });

    const orders = Array.from(ordersMap.values());

    if (!API_TOKEN) {
      await delay(1500);
      return { success: true, message: `${orders.length} órdenes de traspaso generadas (MOCK MODE).` };
    }

    const response = await fetch(`${API_BASE_URL}/transfers/batch`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ orders }),
    });

    if (!response.ok) {
        let errorMsg = `Error HTTP ${response.status}`;
        try {
            const errBody = await response.json();
            if (errBody.message) errorMsg = errBody.message;
        } catch(e) {}
        throw new Error(errorMsg);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error creando órdenes de traspaso:", error);
    return { success: false, error: error.message || "Error al crear órdenes de traspaso en la nube" };
  }
}

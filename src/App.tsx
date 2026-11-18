import React from "react";
import { Toaster } from "sonner";
import { AppProvider, useAppContext } from "./AppContext";
import { Sidebar } from "./components/Sidebar";
import Inicio from "./components/views/Inicio";
import CargarDatos from "./components/views/CargarDatos";
import Inventario from "./components/views/Inventario";
import Alertas from "./components/views/Alertas";

const AppContent: React.FC = () => {
    const { activeView } = useAppContext();

    const renderView = () => {
        switch (activeView) {
            case "inicio":
                return <Inicio />;
            case "cargar":
                return <CargarDatos />;
            case "inventario":
                return <Inventario />;
            case "alertas":
                return <Alertas />;
            default:
                return <Inicio />;
        }
    };

    return (
        <div className="flex h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
            <Toaster position="top-right" richColors />
            <Sidebar />
            <main className="flex-1 overflow-hidden relative flex flex-col">{renderView()}</main>
        </div>
    );
};

export default function App() {
    return (
        <AppProvider>
            <AppContent />
        </AppProvider>
    );
}
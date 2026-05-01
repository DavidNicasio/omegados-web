import React from "react";
import { AppProvider, useAppContext } from "./AppContext";
import { Sidebar } from "./components/Sidebar";
import Inicio from "./components/views/Inicio";
import Paso1 from "./components/views/Paso1";
import Paso2 from "./components/views/Paso2";
import Inventario from "./components/views/Inventario";
import Alertas from "./components/views/Alertas";
import Sync from "./components/views/Sync";

const AppContent: React.FC = () => {
  const { activeView } = useAppContext();

  const renderView = () => {
    switch (activeView) {
      case "inicio":
        return <Inicio />;
      case "paso1":
        return <Paso1 />;
      case "paso2":
        return <Paso2 />;
      case "inventario":
        return <Inventario />;
      case "alertas":
        return <Alertas />;
      case "sync":
        return <Sync />;
      default:
        return <Inicio />;
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 font-sans overflow-hidden">
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

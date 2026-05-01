import React, { createContext, useContext, useState } from "react";
import { MasterRow, Alert } from "./lib/excel";

interface AppState {
  activeView: string;
  setActiveView: (view: string) => void;
  masterData: MasterRow[] | null;
  setMasterData: (data: MasterRow[] | null) => void;
  alerts: Alert[];
  setAlerts: (alerts: Alert[]) => void;
  cols: string[];
  setCols: (cols: string[]) => void;
  fileName: string | null;
  setFileName: (name: string | null) => void;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeView, setActiveView] = useState("inicio");
  const [masterData, setMasterData] = useState<MasterRow[] | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        masterData,
        setMasterData,
        alerts,
        setAlerts,
        cols,
        setCols,
        fileName,
        setFileName,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};

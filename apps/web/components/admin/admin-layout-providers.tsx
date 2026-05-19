"use client";

import type { ReactNode } from "react";
import { useState, createContext, useContext } from "react";

// Lightweight providers without @msqdx/react to avoid TDZ/circular import
// when admin layout loads. The layout client is dynamically imported separately.

const defaultHeaderContext: {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
  /** Renders in the header start row, immediately after the project selector (desktop `md+`). */
  headerStartContent: ReactNode | null;
  setHeaderStartContent: (content: ReactNode | null) => void;
} = {
  headerContent: null,
  setHeaderContent: () => {},
  headerStartContent: null,
  setHeaderStartContent: () => {},
};

const AdminHeaderContext = createContext<{
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
  headerStartContent: ReactNode | null;
  setHeaderStartContent: (content: ReactNode | null) => void;
}>(defaultHeaderContext);

export const useAdminHeader = () => {
  return useContext(AdminHeaderContext);
};

export const AdminHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);
  const [headerStartContent, setHeaderStartContent] = useState<ReactNode | null>(null);

  return (
    <AdminHeaderContext.Provider
      value={{ headerContent, setHeaderContent, headerStartContent, setHeaderStartContent }}
    >
      {children}
    </AdminHeaderContext.Provider>
  );
};

const defaultPanelContext: {
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
} = {
  panelOpen: false,
  setPanelOpen: () => {},
  togglePanel: () => {},
};

const AdminPanelContext = createContext<{
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}>(defaultPanelContext);

export const useAdminPanel = () => {
  return useContext(AdminPanelContext);
};

export const AdminPanelProvider = ({ children }: { children: ReactNode }) => {
  const [panelOpen, setPanelOpen] = useState(false);

  const togglePanel = () => {
    setPanelOpen((prev) => !prev);
  };

  return (
    <AdminPanelContext.Provider value={{ panelOpen, setPanelOpen, togglePanel }}>
      {children}
    </AdminPanelContext.Provider>
  );
};

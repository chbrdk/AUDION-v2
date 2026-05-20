"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { MsqdxGlassAdminHeaderV2ContextDrawer } from "../components/admin/msqdx-glass-admin-header-v2-context-drawer";

type AdminHeaderV2ContextMenuContextValue = {
  openContextDrawer: () => void;
};

const AdminHeaderV2ContextMenuContext =
  createContext<AdminHeaderV2ContextMenuContextValue | null>(null);

export function AdminHeaderV2ContextMenuProvider({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openContextDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const value = useMemo(() => ({ openContextDrawer }), [openContextDrawer]);

  return (
    <AdminHeaderV2ContextMenuContext.Provider value={value}>
      {children}
      <MsqdxGlassAdminHeaderV2ContextDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </AdminHeaderV2ContextMenuContext.Provider>
  );
}

export function useAdminHeaderV2ContextMenuOptional() {
  return useContext(AdminHeaderV2ContextMenuContext);
}

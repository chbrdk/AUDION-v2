"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ShareChatHeaderContextValue = {
  headerContent: ReactNode | null;
  setHeaderContent: (content: ReactNode | null) => void;
};

const ShareChatHeaderContext = createContext<ShareChatHeaderContextValue>({
  headerContent: null,
  setHeaderContent: () => {},
});

export function ShareChatHeaderProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode | null>(null);
  return (
    <ShareChatHeaderContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </ShareChatHeaderContext.Provider>
  );
}

export function useShareChatHeader() {
  return useContext(ShareChatHeaderContext);
}

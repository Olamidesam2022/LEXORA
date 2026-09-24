import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { MatterProgressModal } from "@/components/matters/MatterProgressModal";

interface MatterProgressModalContextValue {
  activeCaseId: string | null;
  openModal: (matterId: string) => void;
  closeModal: () => void;
}

const MatterProgressModalContext =
  createContext<MatterProgressModalContextValue | null>(null);

export function MatterProgressModalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const openModal = useCallback((matterId: string) => {
    setActiveCaseId(matterId);
  }, []);

  const closeModal = useCallback(() => {
    setActiveCaseId(null);
  }, []);

  const value = useMemo(
    () => ({ activeCaseId, openModal, closeModal }),
    [activeCaseId, closeModal, openModal],
  );

  return (
    <MatterProgressModalContext.Provider value={value}>
      {children}
      {activeCaseId && (
        <MatterProgressModal matterId={activeCaseId} onClose={closeModal} />
      )}
    </MatterProgressModalContext.Provider>
  );
}

export function useMatterProgressModal() {
  const context = useContext(MatterProgressModalContext);
  if (!context) {
    throw new Error(
      "useMatterProgressModal must be used within MatterProgressModalProvider",
    );
  }
  return context;
}

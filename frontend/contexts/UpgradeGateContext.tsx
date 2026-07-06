import React, { createContext, useContext, useState } from "react";
import { Modal } from "react-native";
import PricingScreen from "@/screens/subscription/PricingScreen";

interface UpgradeGateContextType {
  presentUpgrade: () => void;
}

const UpgradeGateContext = createContext<UpgradeGateContextType>({
  presentUpgrade: () => {},
});

export function useUpgradeGate() {
  return useContext(UpgradeGateContext);
}

export function isPremiumRequiredError(err: any): boolean {
  return err?.response?.status === 403;
}

export function UpgradeGateProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  return (
    <UpgradeGateContext.Provider value={{ presentUpgrade: () => setVisible(true) }}>
      {children}
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVisible(false)}
      >
        {visible && <PricingScreen onClose={() => setVisible(false)} />}
      </Modal>
    </UpgradeGateContext.Provider>
  );
}

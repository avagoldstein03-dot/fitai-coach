import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { render, fireEvent, screen } from "@testing-library/react-native";
import {
  UpgradeGateProvider,
  useUpgradeGate,
  isPremiumRequiredError,
} from "./UpgradeGateContext";

jest.mock("@/screens/subscription/PricingScreen", () => {
  const { Text: MockText } = require("react-native");
  return function MockPricingScreen() {
    return <MockText>mock-pricing-screen</MockText>;
  };
});

describe("isPremiumRequiredError", () => {
  it("returns true for a 403 axios-shaped error", () => {
    expect(isPremiumRequiredError({ response: { status: 403 } })).toBe(true);
  });

  it("returns false for other status codes", () => {
    expect(isPremiumRequiredError({ response: { status: 500 } })).toBe(false);
  });

  it("returns false for a malformed/missing error", () => {
    expect(isPremiumRequiredError(undefined)).toBe(false);
    expect(isPremiumRequiredError({})).toBe(false);
  });
});

function Consumer() {
  const { presentUpgrade } = useUpgradeGate();
  return (
    <TouchableOpacity onPress={presentUpgrade}>
      <Text>trigger-upgrade</Text>
    </TouchableOpacity>
  );
}

describe("UpgradeGateProvider", () => {
  it("does not show the upgrade modal until presentUpgrade is called", async () => {
    await render(
      <UpgradeGateProvider>
        <Consumer />
      </UpgradeGateProvider>
    );

    expect(screen.queryByText("mock-pricing-screen")).toBeNull();
  });

  it("shows the upgrade modal after presentUpgrade is called", async () => {
    await render(
      <UpgradeGateProvider>
        <Consumer />
      </UpgradeGateProvider>
    );

    await fireEvent.press(screen.getByText("trigger-upgrade"));

    expect(screen.getByText("mock-pricing-screen")).toBeTruthy();
  });
});

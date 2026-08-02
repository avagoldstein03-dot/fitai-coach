import React from "react";
import { Text } from "react-native";
import { render, fireEvent, screen } from "@testing-library/react-native";
import { ErrorBoundary } from "./ErrorBoundary";

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("boom");
  return <Text>safe content</Text>;
}

describe("ErrorBoundary", () => {
  // Suppress React's noisy console.error for the intentionally-thrown error in these tests.
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("renders children normally when there's no error", async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("safe content")).toBeTruthy();
  });

  it("renders the fallback UI when a child throws", async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("boom")).toBeTruthy();
  });

  it("renders a custom fallback when provided", async () => {
    await render(
      <ErrorBoundary fallback={<Text>custom fallback</Text>}>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("custom fallback")).toBeTruthy();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("recovers after retry once the underlying error condition clears", async () => {
    const { rerender } = await render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();

    // Simulate the underlying issue being fixed upstream (e.g. a corrected prop) —
    // the boundary itself still shows the fallback until reset() runs.
    await rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();

    await fireEvent.press(screen.getByText("Try Again"));

    expect(screen.getByText("safe content")).toBeTruthy();
  });
});

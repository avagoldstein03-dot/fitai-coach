import { renderHook } from "@testing-library/react-native";
import axios from "axios";
import { useAuth } from "@clerk/clerk-expo";
import { useAxiosAuth } from "./useAxiosAuth";

jest.mock("@clerk/clerk-expo", () => ({
  useAuth: jest.fn(),
}));

// `interceptors.request.handlers` is an internal axios property (not part of its public
// TS types) — reaching into it directly is the standard way to invoke an attached
// interceptor in a test without making a real HTTP request.
const requestInterceptors = axios.interceptors.request as unknown as {
  handlers: Array<{ fulfilled: (config: any) => any } | null>;
};

describe("useAxiosAuth", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("attaches a Bearer token to requests when signed in", async () => {
    const getToken = jest.fn().mockResolvedValue("test-token");
    (useAuth as jest.Mock).mockReturnValue({ getToken, isSignedIn: true });

    await renderHook(() => useAxiosAuth());

    const currentInterceptor = requestInterceptors.handlers.filter(Boolean).at(-1)!;
    const config = await currentInterceptor.fulfilled({ headers: {} });

    expect(getToken).toHaveBeenCalled();
    expect(config.headers.Authorization).toBe("Bearer test-token");
  });

  it("does not attach a token when signed out", async () => {
    const getToken = jest.fn().mockResolvedValue("test-token");
    (useAuth as jest.Mock).mockReturnValue({ getToken, isSignedIn: false });

    await renderHook(() => useAxiosAuth());

    const currentInterceptor = requestInterceptors.handlers.filter(Boolean).at(-1)!;
    const config = await currentInterceptor.fulfilled({ headers: {} });

    expect(getToken).not.toHaveBeenCalled();
    expect(config.headers.Authorization).toBeUndefined();
  });

  it("proceeds without an auth header if getToken rejects", async () => {
    const getToken = jest.fn().mockRejectedValue(new Error("token fetch failed"));
    (useAuth as jest.Mock).mockReturnValue({ getToken, isSignedIn: true });

    await renderHook(() => useAxiosAuth());

    const currentInterceptor = requestInterceptors.handlers.filter(Boolean).at(-1)!;
    const config = await currentInterceptor.fulfilled({ headers: {} });

    expect(config.headers.Authorization).toBeUndefined();
  });

  it("ejects its interceptor on unmount", async () => {
    const getToken = jest.fn().mockResolvedValue("test-token");
    (useAuth as jest.Mock).mockReturnValue({ getToken, isSignedIn: true });

    const { unmount } = await renderHook(() => useAxiosAuth());
    const handlersBefore = requestInterceptors.handlers.filter(Boolean).length;

    await unmount();

    const handlersAfter = requestInterceptors.handlers.filter(Boolean).length;
    expect(handlersAfter).toBe(handlersBefore - 1);
  });
});

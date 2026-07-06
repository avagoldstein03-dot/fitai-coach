import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import axios from "axios";

/**
 * Attaches the Clerk JWT to every outgoing axios request.
 * Call once near the root of the app (inside ClerkProvider).
 * Uses the global axios instance so all existing screens pick it up automatically.
 */
export function useAxiosAuth() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    const interceptorId = axios.interceptors.request.use(async (config) => {
      if (isSignedIn) {
        try {
          const token = await getToken();
          if (token) {
            config.headers = config.headers ?? {};
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch {
          // Token fetch failed — request proceeds without auth header
        }
      }
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, [getToken, isSignedIn]);
}

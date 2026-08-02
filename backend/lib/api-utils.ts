import { getAuth } from "@clerk/nextjs/server";
import type { NextApiRequest, NextApiResponse } from "next";
import type { ErrorResponse, SuccessResponse } from "@/types/index";

export function sendSuccess<T>(
  res: NextApiResponse,
  data: T,
  message: string = "Success",
  statusCode: number = 200
) {
  const response: SuccessResponse<T> = {
    data,
    message,
    timestamp: new Date(),
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: NextApiResponse,
  error: string,
  message: string = "An error occurred",
  statusCode: number = 400
) {
  const response: ErrorResponse = {
    error,
    message,
    statusCode,
  };
  res.status(statusCode).json(response);
}

export function getAuthenticatedUser(req: NextApiRequest) {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}

export function validateRequest(
  req: NextApiRequest,
  methods: string[]
): boolean {
  return methods.includes(req.method?.toUpperCase() || "");
}

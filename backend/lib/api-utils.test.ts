import type { NextApiRequest, NextApiResponse } from "next";
import { getAuth } from "@clerk/nextjs/server";
import {
  sendSuccess,
  sendError,
  validateRequest,
  getAuthenticatedUser,
} from "./api-utils";

jest.mock("@clerk/nextjs/server", () => ({
  getAuth: jest.fn(),
}));

function mockRes() {
  const res: Partial<NextApiResponse> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as NextApiResponse & { status: jest.Mock; json: jest.Mock };
}

describe("sendSuccess", () => {
  it("responds with 200 and the data payload by default", () => {
    const res = mockRes();
    sendSuccess(res, { id: "abc" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { id: "abc" }, message: "Success" })
    );
  });

  it("honors a custom message and status code", () => {
    const res = mockRes();
    sendSuccess(res, null, "Account deleted successfully", 201);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: null, message: "Account deleted successfully" })
    );
  });
});

describe("sendError", () => {
  it("responds with 400 by default", () => {
    const res = mockRes();
    sendError(res, "validation_error", "message is required");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "validation_error",
      message: "message is required",
      statusCode: 400,
    });
  });

  it("honors a custom status code", () => {
    const res = mockRes();
    sendError(res, "rate_limited", "Too many requests", 429);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe("validateRequest", () => {
  it("returns true when the request method is in the allowed list", () => {
    const req = { method: "POST" } as NextApiRequest;
    expect(validateRequest(req, ["POST", "GET"])).toBe(true);
  });

  it("returns false when the request method is not allowed", () => {
    const req = { method: "DELETE" } as NextApiRequest;
    expect(validateRequest(req, ["POST", "GET"])).toBe(false);
  });

  it("is case-insensitive on the request method", () => {
    const req = { method: "post" } as NextApiRequest;
    expect(validateRequest(req, ["POST"])).toBe(true);
  });
});

describe("getAuthenticatedUser", () => {
  it("returns the userId when authenticated", () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: "user_123" });
    const req = {} as NextApiRequest;
    expect(getAuthenticatedUser(req)).toBe("user_123");
  });

  it("throws when there is no authenticated user", () => {
    (getAuth as jest.Mock).mockReturnValue({ userId: null });
    const req = {} as NextApiRequest;
    expect(() => getAuthenticatedUser(req)).toThrow("Unauthorized");
  });
});

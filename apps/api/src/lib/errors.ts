export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const unauthorized = (message = "Authentication required") => new ApiError(401, message, "unauthorized");
export const forbidden = (message = "Not allowed") => new ApiError(403, message, "forbidden");
export const notFound = (message = "Not found") => new ApiError(404, message, "not_found");
export const badRequest = (message: string) => new ApiError(400, message, "bad_request");
export const tooManyRequests = (message = "Rate limit exceeded") => new ApiError(429, message, "rate_limited");
export const conflict = (message: string) => new ApiError(409, message, "conflict");

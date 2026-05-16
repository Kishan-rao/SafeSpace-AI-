function createHttpError(status, error, detail) {
  const httpError = new Error(detail || error);
  httpError.status = status;
  httpError.error = error;
  httpError.detail = detail || error;
  return httpError;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function sendApiError(req, res, status, error, detail, extra = {}) {
  return res.status(status).json({
    ok: false,
    error,
    detail,
    requestId: req.id,
    ...extra,
  });
}

function notFoundHandler(req, res, next) {
  if (req.path.startsWith("/api")) {
    return sendApiError(req, res, 404, "Not Found", `No API route exists for ${req.method} ${req.path}.`);
  }

  return next();
}

function getErrorResponse(error, isProduction) {
  if (error.type === "entity.too.large") {
    return {
      status: 413,
      title: "Payload too large",
      detail: "The request body is larger than this endpoint accepts.",
    };
  }

  if (error instanceof SyntaxError && "body" in error) {
    return {
      status: 400,
      title: "Invalid JSON",
      detail: "The request body contains malformed JSON.",
    };
  }

  if (error.name === "ValidationError") {
    return {
      status: 400,
      title: "Validation failed",
      detail: error.message,
    };
  }

  if (error.name === "CastError") {
    return {
      status: 400,
      title: "Invalid request value",
      detail: error.message,
    };
  }

  const status = Number(error.status || error.statusCode) || 500;
  return {
    status,
    title: error.error || (status >= 500 ? "Internal Server Error" : "Request failed"),
    detail:
      status >= 500 && isProduction
        ? "An unexpected server error occurred."
        : error.detail || error.message || "An unexpected error occurred.",
  };
}

function errorHandler({ isProduction = false } = {}) {
  return (error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    const response = getErrorResponse(error, isProduction);
    if (response.status >= 500) {
      console.error(`[${req.id || "no-request-id"}]`, error.stack || error);
    }

    return sendApiError(req, res, response.status, response.title, response.detail);
  };
}

module.exports = {
  asyncHandler,
  createHttpError,
  errorHandler,
  notFoundHandler,
  sendApiError,
};

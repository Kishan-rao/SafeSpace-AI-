const { createHttpError } = require("./error-handler");

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const detail = result.error.issues.map((i) => i.message).join(" ");
      return next(createHttpError(400, "Validation failed", detail || "Invalid request body."));
    }
    req.validatedBody = result.data;
    next();
  };
}

module.exports = { validateBody };

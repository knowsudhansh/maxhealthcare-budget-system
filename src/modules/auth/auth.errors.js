const { AppError } = require("../../errors/app-error");

function authError(statusCode, publicCode, publicMessage, details) {
  return new AppError({
    statusCode,
    publicCode,
    publicMessage,
    details
  });
}

module.exports = {
  authError
};

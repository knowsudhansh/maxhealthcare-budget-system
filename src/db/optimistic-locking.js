const { conflictError } = require("../errors/app-error");

function buildVersionedWhere(idColumn = "id", versionColumn = "record_version") {
  return `${idColumn} = ? AND ${versionColumn} = ?`;
}

function assertVersionedUpdateAffected(affectedRows) {
  if (!affectedRows) {
    throw conflictError("This record was changed by another user. Refresh and review the latest version.");
  }
}

module.exports = {
  assertVersionedUpdateAffected,
  buildVersionedWhere
};

function mapLocation(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    code: row.code,
    name: row.name,
    status: row.status,
    parentLocationId: row.parent_location_id === null || row.parent_location_id === undefined ? null : Number(row.parent_location_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAssignment(row) {
  if (!row) return null;
  return {
    assignmentId: `${row.user_id}:${row.location_id}:${row.access_type}`,
    userId: Number(row.user_id),
    locationId: Number(row.location_id),
    locationCode: row.location_code || row.code,
    locationName: row.location_name || row.name,
    locationStatus: row.location_status || row.status,
    accessType: row.access_type,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    assignedBy: row.assigned_by,
    createdAt: row.created_at
  };
}

async function listLocations(db, options = {}) {
  const params = [];
  let where = "";
  if (options.activeOnly) {
    where = "WHERE status = ?";
    params.push("ACTIVE");
  }
  const [rows] = await db.execute(
    `
      SELECT *
      FROM locations
      ${where}
      ORDER BY name, code
    `,
    params
  );
  return (rows || []).map(mapLocation);
}

async function findLocationById(db, id) {
  const [rows] = await db.execute("SELECT * FROM locations WHERE id = ? LIMIT 1", [id]);
  return mapLocation(rows && rows[0]);
}

async function findLocationByCode(db, code) {
  const [rows] = await db.execute("SELECT * FROM locations WHERE code = ? LIMIT 1", [code]);
  return mapLocation(rows && rows[0]);
}

async function createLocation(db, payload) {
  const [result] = await db.execute(
    `
      INSERT INTO locations (code, name, status, parent_location_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `,
    [payload.code, payload.name, payload.status || "ACTIVE", payload.parentLocationId || null]
  );
  return findLocationById(db, result.insertId);
}

async function updateLocation(db, id, payload) {
  const current = await findLocationById(db, id);
  if (!current) return null;
  await db.execute(
    `
      UPDATE locations
      SET code = ?,
          name = ?,
          status = ?,
          parent_location_id = ?,
          updated_at = NOW()
      WHERE id = ?
    `,
    [
      Object.prototype.hasOwnProperty.call(payload, "code") ? payload.code : current.code,
      Object.prototype.hasOwnProperty.call(payload, "name") ? payload.name : current.name,
      Object.prototype.hasOwnProperty.call(payload, "status") ? payload.status : current.status,
      Object.prototype.hasOwnProperty.call(payload, "parentLocationId") ? payload.parentLocationId : current.parentLocationId,
      id
    ]
  );
  return findLocationById(db, id);
}

async function listActiveAssignmentsForUser(db, userId) {
  const [rows] = await db.execute(
    `
      SELECT
        ul.*,
        l.code AS location_code,
        l.name AS location_name,
        l.status AS location_status
      FROM user_locations ul
      INNER JOIN locations l ON l.id = ul.location_id
      WHERE ul.user_id = ?
        AND l.status = 'ACTIVE'
        AND (ul.valid_from IS NULL OR ul.valid_from <= NOW())
        AND (ul.valid_until IS NULL OR ul.valid_until > NOW())
      ORDER BY l.name, ul.access_type
    `,
    [userId]
  );
  return (rows || []).map(mapAssignment);
}

async function listAssignmentsForUser(db, userId) {
  const [rows] = await db.execute(
    `
      SELECT
        ul.*,
        l.code AS location_code,
        l.name AS location_name,
        l.status AS location_status
      FROM user_locations ul
      INNER JOIN locations l ON l.id = ul.location_id
      WHERE ul.user_id = ?
      ORDER BY l.name, ul.access_type
    `,
    [userId]
  );
  return (rows || []).map(mapAssignment);
}

async function replaceAssignmentsForUser(db, userId, assignments, actorUserId) {
  await db.execute("DELETE FROM user_locations WHERE user_id = ?", [userId]);
  for (const assignment of assignments) {
    await upsertAssignment(db, userId, assignment, actorUserId);
  }
}

async function upsertAssignment(db, userId, assignment, actorUserId) {
  await db.execute(
    `
      INSERT INTO user_locations (user_id, location_id, access_type, valid_from, valid_until, assigned_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        valid_from = VALUES(valid_from),
        valid_until = VALUES(valid_until),
        assigned_by = VALUES(assigned_by)
    `,
    [
      userId,
      assignment.locationId,
      assignment.accessType,
      assignment.validFrom || null,
      assignment.validUntil || null,
      actorUserId || null
    ]
  );
}

async function deleteAssignment(db, userId, locationId, accessType) {
  const [result] = await db.execute(
    "DELETE FROM user_locations WHERE user_id = ? AND location_id = ? AND access_type = ?",
    [userId, locationId, accessType]
  );
  return result.affectedRows || 0;
}

module.exports = {
  createLocation,
  deleteAssignment,
  findLocationByCode,
  findLocationById,
  listActiveAssignmentsForUser,
  listAssignmentsForUser,
  listLocations,
  replaceAssignmentsForUser,
  updateLocation,
  upsertAssignment
};

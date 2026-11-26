// Checks the map box and turns it into a MongoDB filter.
// Input looks like "west,south,east,north" (longitude first, then latitude).
// Returns { error } if something is wrong, or { geoFilter } if all is fine.

function parseBbox(raw) {
  if (typeof raw !== 'string') {
    return { error: 'bbox must be four numbers: west,south,east,north' };
  }

  const parts = raw.split(',').map((p) => p.trim());
  if (parts.length !== 4 || parts.some((p) => p === '')) {
    return { error: 'bbox must contain exactly four numbers: west,south,east,north' };
  }

  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) {
    return { error: 'bbox values must all be valid numbers' };
  }

  const [west, south, east, north] = nums;

  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return { error: 'bbox longitudes (west, east) must be between -180 and 180' };
  }
  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return { error: 'bbox latitudes (south, north) must be between -90 and 90' };
  }
  if (west >= east) return { error: 'bbox west must be less than east' };
  if (south >= north) return { error: 'bbox south must be less than north' };

  // A rectangle drawn as a closed shape (the last point repeats the first).
  const polygon = {
    type: 'Polygon',
    coordinates: [[
      [west, south],
      [east, south],
      [east, north],
      [west, north],
      [west, south]
    ]]
  };

  // Reports without coordinates never match this, so they are left out automatically.
  return { geoFilter: { $geoWithin: { $geometry: polygon } } };
}

module.exports = { parseBbox };
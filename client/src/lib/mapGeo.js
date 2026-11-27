export const DEFAULT_MAP_CENTER = [12.9716, 77.5946];
export const DEFAULT_MAP_ZOOM = 12;
export const GRID_CELL_SIZE = 0.0015; // ~165m urban micro-zone

export const WARD_COORDINATES = {
  'Ward 14': [12.9352, 77.6245],
  'Ward 08': [12.9767, 77.5713],
  'Ward 22': [13.0285, 77.5896],
  'Ward 11': [12.9698, 77.5326],
  'Ward 03': [12.9784, 77.5724],
  'Ward 05': [12.985, 77.638]
};

export const MOCK_EXPERIENCE_SPOTS = [
  {
    id: 'REP-EXP-201',
    reportId: 'REP-EXP-201',
    type: 'experience',
    title: 'Sector 4 Link Road Dark Stretch (Pole #42-#49)',
    category: 'Streetlight Issues',
    wardNumber: 'Ward 22',
    location: 'Sector 4 Link Road, Ward 22',
    description: 'Seven non-functional streetlights leave a 400m pedestrian corridor dark after 19:30.',
    timeOfDay: 'Night',
    verifiedCount: 7,
    verifiedBy: [],
    status: 'Reported',
    geo: { type: 'Point', coordinates: [77.5896, 13.0285] }
  },
  {
    id: 'REP-EXP-202',
    reportId: 'REP-EXP-202',
    type: 'experience',
    title: 'Sector 4 Bus Stop Approach — Zero Illumination',
    category: 'Streetlight Issues',
    wardNumber: 'Ward 22',
    location: 'Sector 4 Crossroad 5, Ward 22',
    description: 'Pedestrians forced onto carriageway due to broken sodium lamps near metro feeder stop.',
    timeOfDay: 'Night',
    verifiedCount: 5,
    verifiedBy: [],
    status: 'Reported',
    geo: { type: 'Point', coordinates: [77.5903, 13.0291] }
  },
  {
    id: 'REP-EXP-203',
    reportId: 'REP-EXP-203',
    type: 'experience',
    title: 'Central Bus Terminal South Gate Curb Barrier',
    category: 'Footpath and Accessibility',
    wardNumber: 'Ward 03',
    location: 'South Gate Pedestrian Crossing, Central Bus Stand',
    description: '8-inch vertical concrete curb without drop ramp blocks wheelchair and elderly access.',
    timeOfDay: 'All Day',
    verifiedCount: 5,
    verifiedBy: [],
    status: 'Reported',
    geo: { type: 'Point', coordinates: [77.5724, 12.9784] }
  },
  {
    id: 'REP-EXP-204',
    reportId: 'REP-EXP-204',
    type: 'experience',
    title: 'Old Canal Road Missing Footpath Shoulder',
    category: 'Public Safety',
    wardNumber: 'Ward 14',
    location: 'Canal Road, Ward 14',
    description: 'Missing pedestrian shoulder along narrow curve with fast-moving evening traffic.',
    timeOfDay: 'Night',
    verifiedCount: 6,
    verifiedBy: [],
    status: 'Reported',
    geo: { type: 'Point', coordinates: [77.6245, 12.9352] }
  }
];

function deterministicOffset(seedStr, range = 0.008) {
  let hash = 0;
  const s = String(seedStr || '0');
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 100000;
  }
  return ((hash % 1000) / 1000 - 0.5) * range;
}

export function getCoordinatesForReport(report, isMockMode) {
  const coords = report?.geo?.coordinates;
  if (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    Number.isFinite(Number(coords[0])) &&
    Number.isFinite(Number(coords[1]))
  ) {
    return [Number(coords[0]), Number(coords[1])]; // [lng, lat]
  }

  if (!isMockMode) return null;

  const wardKey = Object.keys(WARD_COORDINATES).find((w) =>
    String(report?.wardNumber || report?.location || '').includes(w)
  );
  const [lat, lng] = wardKey ? WARD_COORDINATES[wardKey] : DEFAULT_MAP_CENTER;
  return [
    lng + deterministicOffset(`${report?.id}-lng`, 0.014),
    lat + deterministicOffset(`${report?.id}-lat`, 0.014)
  ];
}

export function statusPinColor(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('citizen-confirmed') || s.includes('confirmed')) return '#216E39';
  if (s.includes('resolved')) return '#16A34A';
  if (s.includes('progress')) return '#D97706';
  if (s.includes('assigned')) return '#7C3AED';
  if (s.includes('escalated') || s.includes('reopened')) return '#B30000';
  if (s.includes('verified')) return '#0D6EFD';
  return '#003366';
}

export function buildReportGeoFeatures(reports, { isMockMode, statusFilter = '', categoryFilter = '' } = {}) {
  const features = [];
  let unmappedCount = 0;

  (reports || []).forEach((r) => {
    if (r.type === 'experience') return;
    if (statusFilter && !String(r.status || '').toLowerCase().includes(statusFilter.toLowerCase())) {
      return;
    }
    if (categoryFilter && !String(r.category || '').toLowerCase().includes(categoryFilter.toLowerCase())) {
      return;
    }

    const coords = getCoordinatesForReport(r, isMockMode);
    if (!coords) {
      unmappedCount += 1;
      return;
    }

    features.push({
      type: 'Feature',
      id: r.id || r.ticketNumber,
      geometry: {
        type: 'Point',
        coordinates: coords
      },
      properties: {
        id: r.id,
        ticketNumber: r.ticketNumber,
        title: r.title,
        category: r.category,
        status: r.status,
        severity: r.severity,
        wardNumber: r.wardNumber || r.location,
        verifiedCount: r.verifiedCount ?? 0
      }
    });
  });

  return { features, unmappedCount };
}

function matchesMapFilters(item, { statusFilter = '', categoryFilter = '' } = {}) {
  if (statusFilter && !String(item?.status || '').toLowerCase().includes(statusFilter.toLowerCase())) {
    return false;
  }
  if (categoryFilter && !String(item?.category || '').toLowerCase().includes(categoryFilter.toLowerCase())) {
    return false;
  }
  return true;
}

export function extractBlindSpotItems(reports, isMockMode, filters = {}) {
  const liveExperience = (reports || []).filter((r) => r.type === 'experience');
  const pool = isMockMode ? [...liveExperience, ...MOCK_EXPERIENCE_SPOTS] : liveExperience;

  const mapped = [];
  let unmappedSpots = 0;

  pool.forEach((spot) => {
    if (!matchesMapFilters(spot, filters)) return;
    const coords = getCoordinatesForReport(spot, isMockMode);
    if (!coords) {
      unmappedSpots += 1;
      return;
    }
    mapped.push({
      ...spot,
      coordinates: coords // [lng, lat]
    });
  });

  return { spots: mapped, unmappedSpots };
}

export function buildBlindSpotGrid(
  reports,
  isMockMode,
  { statusFilter = '', categoryFilter = '', extraVotedIds = null, currentUserId = '' } = {}
) {
  const { spots, unmappedSpots } = extractBlindSpotItems(reports, isMockMode, {
    statusFilter,
    categoryFilter
  });
  const cells = {};

  spots.forEach((spot) => {
    const [lng, lat] = spot.coordinates;
    const x = Math.floor(lng / GRID_CELL_SIZE);
    const y = Math.floor(lat / GRID_CELL_SIZE);
    const key = `${x}:${y}`;
    if (!cells[key]) {
      cells[key] = { cellKey: key, x, y, votes: 0, spots: 0, reports: 0 };
    }
    const spotKey = spot.reportId || spot.id;
    const alreadyInVerifiedBy = Boolean(
      currentUserId && Array.isArray(spot.verifiedBy) && spot.verifiedBy.includes(currentUserId)
    );
    const mockExtraVote =
      isMockMode && !alreadyInVerifiedBy && Boolean(extraVotedIds?.has(spotKey)) ? 1 : 0;

    cells[key].spots += 1;
    cells[key].votes += 1 + (Number(spot.verifiedCount) || 0) + mockExtraVote;
  });

  (reports || []).forEach((rep) => {
    if (rep.type === 'experience') return;
    if (!matchesMapFilters(rep, { statusFilter, categoryFilter })) return;
    const coords = getCoordinatesForReport(rep, isMockMode);
    if (!coords) return;
    const x = Math.floor(coords[0] / GRID_CELL_SIZE);
    const y = Math.floor(coords[1] / GRID_CELL_SIZE);
    const key = `${x}:${y}`;
    if (cells[key]) {
      cells[key].reports += 1;
    }
  });

  const gridCells = Object.values(cells).map((c) => ({
    ...c,
    bounds: [
      c.x * GRID_CELL_SIZE,
      c.y * GRID_CELL_SIZE,
      (c.x + 1) * GRID_CELL_SIZE,
      (c.y + 1) * GRID_CELL_SIZE
    ],
    score: c.votes / (1 + c.reports)
  }));

  return { spots, unmappedSpots, gridCells };
}

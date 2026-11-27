export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
export const IS_MOCK_MODE = import.meta.env.VITE_USE_MOCK === 'true';

const AUTH_STORAGE_KEY = 'civicreflex_auth_user_v4';
const VALID_ACTOR_ROLES = new Set(['citizen', 'authority', 'field_officer', 'admin']);

export class ApiClientError extends Error {
  constructor(message, status = 500, payload = null) {
    super(message || 'Request failed');
    this.name = 'ApiClientError';
    this.status = status;
    this.payload = payload;
  }
}

export function getStoredActor() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const role = String(parsed?.role || '').trim().toLowerCase();
    const id = String(parsed?.id || '').trim();
    const name = String(parsed?.name || '').trim();
    if (!VALID_ACTOR_ROLES.has(role) || !id || !name) return null;
    return { role, id, name };
  } catch {
    return null;
  }
}

export function buildActorHeaders(actorOverride = null) {
  const actor = actorOverride || getStoredActor();
  if (!actor) return {};
  const role = String(actor.role || '').trim().toLowerCase();
  const id = String(actor.id || '').trim();
  const name = String(actor.name || '').trim();
  if (!VALID_ACTOR_ROLES.has(role) || !id || !name) return {};
  return {
    'x-actor-role': role,
    'x-actor-id': id,
    'x-actor-name': name
  };
}

export async function apiRequest(
  path,
  {
    method = 'GET',
    params = null,
    body = undefined,
    headers = {},
    includeActor = false,
    actor = null,
    idempotencyKey = null,
    signal = undefined
  } = {}
) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${API_BASE_URL}${normalizedPath}`);

  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const requestHeaders = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(includeActor || actor ? buildActorHeaders(actor) : {}),
    ...(idempotencyKey ? { 'Idempotency-Key': String(idempotencyKey) } : {}),
    ...headers
  };

  if ((includeActor || actor) && !requestHeaders['x-actor-role']) {
    throw new ApiClientError(
      'Authentication required: please sign in before performing this action.',
      401
    );
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      credentials: 'include',
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (networkErr) {
    if (networkErr?.name === 'AbortError') throw networkErr;
    throw new ApiClientError(
      `Unable to connect to the CivicReflex backend server (${API_BASE_URL}).`,
      0
    );
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      response.statusText ||
      'Server error';
    throw new ApiClientError(message, response.status, payload);
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

export async function fetchAllPaginated(path, params = {}, options = {}) {
  const limit = Math.min(Number(params.limit) || 50, 50);
  const first = await apiRequest(path, {
    ...options,
    params: { ...params, page: 1, limit }
  });

  const allItems = Array.isArray(first?.items) ? [...first.items] : [];
  const total = Number(first?.total) || allItems.length;
  const totalPages = Math.min(Math.ceil(total / limit), 20);

  for (let page = 2; page <= totalPages; page++) {
    const next = await apiRequest(path, {
      ...options,
      params: { ...params, page, limit }
    });
    if (Array.isArray(next?.items)) {
      allItems.push(...next.items);
    }
  }

  return { items: allItems, total };
}

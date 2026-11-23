export const createIdempotencyKey = () => crypto.randomUUID();

export const idempotencyHeaders = (key) => ({ 'Idempotency-Key': key });
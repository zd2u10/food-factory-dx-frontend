import { apiGet, apiPost } from './client.js';

/** 対応待ち(ON_HOLD)の保留一覧を取得する。 */
export function listOpenHolds() {
  return apiGet('/holds');
}

export function resolveAsReturned(holdId, comment) {
  return apiPost(`/holds/${holdId}/resolve-returned`, { comment });
}

export function resolveAsAcceptedLate(holdId, comment) {
  return apiPost(`/holds/${holdId}/resolve-accepted-late`, { comment });
}

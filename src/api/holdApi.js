import { apiGet, apiPost } from './client.js';

/** 対応待ち(ON_HOLD)の保留一覧を取得する。 */
export function listOpenHolds() {
  return apiGet('/holds');
}

/** 指定した発注に関わった保留の履歴を、ステータス問わず全件取得する(発注詳細画面での表示用)。 */
export function listHoldsByOrderId(orderId) {
  return apiGet(`/holds?orderId=${orderId}`);
}

export function resolveAsReturned(holdId, comment) {
  return apiPost(`/holds/${holdId}/resolve-returned`, { comment });
}

export function resolveAsAcceptedLate(holdId, comment) {
  return apiPost(`/holds/${holdId}/resolve-accepted-late`, { comment });
}

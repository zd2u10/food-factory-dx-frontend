import { apiGet, apiPost } from './client.js';

export function listMaterialArrivals() {
  return apiGet('/material-arrivals');
}

export function createMaterialArrival(arrival) {
  return apiPost('/material-arrivals', arrival);
}

export function listArrivalLines(arrivalId) {
  return apiGet(`/material-arrivals/${arrivalId}/lines`);
}

/**
 * 入荷明細を検品結果込みで登録する。
 * resolvesHoldIdを指定すると、その保留(hold_resolution)に対する交換品としての登録になる。
 * 新規入荷(交換ではない)の場合はresolvesHoldIdを省略する。
 * arrivedQty(入荷総量)はサーバー側で自動計算されるため、lineには含めない。
 */
export function registerArrivalLine(arrivalId, line, resolvesHoldId) {
  const query = resolvesHoldId ? `?resolvesHoldId=${resolvesHoldId}` : '';
  return apiPost(`/material-arrivals/${arrivalId}/lines${query}`, line);
}

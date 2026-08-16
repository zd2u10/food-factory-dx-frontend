import { apiGet, apiPost } from './client.js';

export function listMaterialOrders() {
  return apiGet('/material-orders');
}

export function createMaterialOrder(order) {
  return apiPost('/material-orders', order);
}

/** 発注に紐づく入荷明細を全件取得する(発注の充足内訳の確認用)。 */
export function listOrderLines(orderId) {
  return apiGet(`/material-orders/${orderId}/lines`);
}

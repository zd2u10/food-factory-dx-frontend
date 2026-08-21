import { apiGet, apiPost, apiPut } from './client.js';

export function listCustomerOrders() {
  return apiGet('/customer-orders');
}

export function createCustomerOrder(order) {
  return apiPost('/customer-orders', order);
}

export function confirmCustomerOrder(orderId) {
  return apiPost(`/customer-orders/${orderId}/confirm`, {});
}

export function cancelCustomerOrder(orderId) {
  return apiPost(`/customer-orders/${orderId}/cancel`, {});
}

export function listOrderLines(orderId) {
  return apiGet(`/customer-orders/${orderId}/lines`);
}

export function createOrderLine(orderId, line) {
  return apiPost(`/customer-orders/${orderId}/lines`, line);
}

/** 受注明細を編集する(商品・数量とも変更可能。出荷済み数量を下回る変更は400エラーになる)。 */
export function updateOrderLine(orderId, lineId, line) {
  return apiPut(`/customer-orders/${orderId}/lines/${lineId}`, line);
}

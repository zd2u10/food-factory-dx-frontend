import { apiGet, apiPost } from './client.js';

export function listShipments() {
  return apiGet('/shipments');
}

export function createShipment(shipment) {
  return apiPost('/shipments', shipment);
}

/** 指定した受注明細について、出荷のFEFO自動選定をプレビューする(在庫は変更しない)。 */
export function previewShipmentAllocation(orderLineId) {
  return apiGet(`/order-lines/${orderLineId}/shipment-preview`);
}

/** 出荷明細を登録する。allocationsは [{ batchId, shippedQty }, ...] の形。 */
export function registerShipmentLines(shipmentId, orderLineId, allocations) {
  return apiPost(`/shipments/${shipmentId}/lines`, { orderLineId, allocations });
}

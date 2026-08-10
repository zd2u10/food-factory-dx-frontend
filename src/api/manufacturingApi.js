import { apiGet, apiPost } from './client.js';

export function listBatches() {
  return apiGet('/batches');
}

export function listBatchUsages(batchId) {
  return apiGet(`/batches/${batchId}/usages`);
}

export function listStaleDrafts(days = 3) {
  return apiGet(`/batches/stale-drafts?days=${days}`);
}

export function createBatch(itemId, payload) {
  return apiPost(`/items/${itemId}/batches`, payload);
}

export function confirmPlan(batchId) {
  return apiPost(`/batches/${batchId}/confirm-plan`, {});
}

export function confirmPlanBulk(batchIds) {
  return apiPost('/batches/confirm-plan-bulk', { batchIds });
}

export function cancelBatch(batchId, cancelComment) {
  return apiPost(`/batches/${batchId}/cancel`, { cancelComment });
}

export function previewFefo(itemId) {
  return apiGet(`/items/${itemId}/fefo-preview`);
}

export function executeBatch(batchId, actualUsages) {
  return apiPost(`/batches/${batchId}/execute`, actualUsages);
}

export function completeBatch(batchId, payload) {
  return apiPost(`/batches/${batchId}/complete`, payload);
}

export function rejectBatch(batchId, rejectComment) {
  return apiPost(`/batches/${batchId}/reject`, { rejectComment });
}

export function runMrp() {
  return apiPost('/mrp/run', {});
}

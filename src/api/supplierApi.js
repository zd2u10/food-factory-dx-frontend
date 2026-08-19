import { apiGet, apiPost, apiPut } from './client.js';

export function listSuppliers(active = '') {
  const query = active !== '' ? `?active=${active}` : '';
  return apiGet(`/suppliers${query}`);
}

export function createSupplier(supplier) {
  return apiPost('/suppliers', supplier);
}

export function updateSupplier(supplierId, supplier) {
  return apiPut(`/suppliers/${supplierId}`, supplier);
}

export function deactivateSupplier(supplierId) {
  return apiPost(`/suppliers/${supplierId}/deactivate`, {});
}

export function reactivateSupplier(supplierId) {
  return apiPost(`/suppliers/${supplierId}/reactivate`, {});
}

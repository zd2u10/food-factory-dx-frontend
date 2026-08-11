import { apiGet, apiPost, apiPut } from './client.js';

export function listItems(active = '') {
  const query = active !== '' ? `?active=${active}` : '';
  return apiGet(`/items${query}`);
}

export function createItem(item) {
  return apiPost('/items', item);
}

export function updateItem(itemId, item) {
  return apiPut(`/items/${itemId}`, item);
}

export function deactivateItem(itemId) {
  return apiPost(`/items/${itemId}/deactivate`, {});
}

export function reactivateItem(itemId) {
  return apiPost(`/items/${itemId}/reactivate`, {});
}

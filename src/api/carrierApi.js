import { apiGet, apiPost, apiPut } from './client.js';

export function listCarriers() {
  return apiGet('/carriers');
}

export function createCarrier(carrier) {
  return apiPost('/carriers', carrier);
}

export function updateCarrier(carrierId, carrier) {
  return apiPut(`/carriers/${carrierId}`, carrier);
}

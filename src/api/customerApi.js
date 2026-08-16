import { apiGet, apiPost, apiPut } from './client.js';

export function listCustomers() {
  return apiGet('/customers');
}

export function createCustomer(customer) {
  return apiPost('/customers', customer);
}

export function updateCustomer(customerId, customer) {
  return apiPut(`/customers/${customerId}`, customer);
}

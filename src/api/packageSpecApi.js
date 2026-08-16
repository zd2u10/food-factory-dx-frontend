import { apiGet, apiPost, apiPut } from './client.js';

export function listPackageSpecs(materialId) {
  return apiGet(`/materials/${materialId}/package-specs`);
}

export function createPackageSpec(materialId, spec) {
  return apiPost(`/materials/${materialId}/package-specs`, spec);
}

export function updatePackageSpec(materialId, specId, spec) {
  return apiPut(`/materials/${materialId}/package-specs/${specId}`, spec);
}

/**
 * 産地を削除する。DELETEメソッドはapiGet/apiPost/apiPutと違いbodyを持たないため、
 * client.jsの共通requestを直接使わず、専用に組み立てている。
 */
export function deletePackageSpec(materialId, specId) {
  return fetch(`http://localhost:8080/api/materials/${materialId}/package-specs/${specId}`, {
    method: 'DELETE',
  }).then((res) => {
    if (!res.ok) throw new Error(`削除に失敗しました(status: ${res.status})`);
  });
}

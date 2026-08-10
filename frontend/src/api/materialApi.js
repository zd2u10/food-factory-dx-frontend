import { apiGet, apiPost, apiPut } from './client.js';

/**
 * 材料の一覧を取得する。filtersは { category, active } の形。
 * どちらも空文字('')であれば、その条件はURLに含めない(=絞り込まない)。
 *
 * URLSearchParams: "?category=RAW&active=true" のようなクエリ文字列を
 * 組み立ててくれる標準機能。値を1つずつ手でつなげて文字列を作るより安全
 * (日本語や記号が含まれていても自動的に正しい形にエンコードしてくれる)。
 */
export function listMaterials(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.active !== '') params.set('active', filters.active);

  const query = params.toString();
  return apiGet(`/materials${query ? `?${query}` : ''}`);
}

export function createMaterial(material) {
  return apiPost('/materials', material);
}

export function updateMaterial(materialId, material) {
  return apiPut(`/materials/${materialId}`, material);
}

export function deactivateMaterial(materialId) {
  return apiPost(`/materials/${materialId}/deactivate`, {});
}

export function reactivateMaterial(materialId) {
  return apiPost(`/materials/${materialId}/reactivate`, {});
}

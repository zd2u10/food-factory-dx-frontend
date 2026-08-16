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
  // filters.active が undefined(そもそも指定されなかった)の場合と、
  // 空文字 ''(呼び出し側が明示的に「絞り込まない」を選んだ場合)の両方を、
  // 同じ「絞り込まない」として扱う。以前は空文字だけを見ていたため、
  // undefinedが素通りして "active=undefined" という不正な文字列がURLに付いてしまっていた。
  if (filters.active !== undefined && filters.active !== '') {
    params.set('active', filters.active);
  }

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

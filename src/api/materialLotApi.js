import { apiGet } from './client.js';

/**
 * materialIdを指定すればその材料のロットだけ、省略すれば在庫が残っている全ロットを取得する。
 */
export function listMaterialLots(materialId) {
  const query = materialId ? `?materialId=${materialId}` : '';
  return apiGet(`/material-lots${query}`);
}

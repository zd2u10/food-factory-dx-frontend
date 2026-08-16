import { apiGet, apiPost, apiPut } from './client.js';

export function listRecipeItems(itemId) {
  return apiGet(`/items/${itemId}/recipe-items`);
}

export function createRecipeItem(itemId, recipeItem) {
  return apiPost(`/items/${itemId}/recipe-items`, recipeItem);
}

/** 複数のレシピ明細を一括登録する。recipeItemsは配列。 */
export function createRecipeItemsBulk(itemId, recipeItems) {
  return apiPost(`/items/${itemId}/recipe-items/bulk`, recipeItems);
}

export function updateRecipeItem(itemId, recipeItemId, recipeItem) {
  return apiPut(`/items/${itemId}/recipe-items/${recipeItemId}`, recipeItem);
}

/** 誤って登録した明細を削除する。DELETEはbodyを持たないため、専用に組み立てている。 */
export function deleteRecipeItem(itemId, recipeItemId) {
  return fetch(`http://localhost:8080/api/items/${itemId}/recipe-items/${recipeItemId}`, {
    method: 'DELETE',
  }).then((res) => {
    if (!res.ok) throw new Error(`削除に失敗しました(status: ${res.status})`);
  });
}

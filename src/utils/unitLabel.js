/**
 * 材料のbaseUnit(WEIGHT/VOLUME)から、表示用の単位文字列を返す。
 * 材料の数量(発注数量・在庫量・使用量など)を画面に表示する際、
 * 常にこの関数経由で単位を付けることで、現場の人が「これは何の数字か」を
 * 一瞬で判断できるようにする。
 */
export function materialUnitLabel(baseUnit) {
  if (baseUnit === 'WEIGHT') return 'g';
  if (baseUnit === 'VOLUME') return 'ml';
  return '';
}

/**
 * 商品の数量に付ける単位。現状は「個」固定。
 *
 * 【将来の拡張余地】商品によっては「袋」「箱」のような、個数以外の販売単位で
 * 数えたいケースが将来的に想定される。その場合は items テーブルに
 * sales_unit のような列を追加し、この関数がそこから動的に単位を
 * 判定するように拡張する想定(現時点では未実装、常に「個」を返す)。
 */
export function itemUnitLabel() {
  return '個';
}

/** 材料の数量に、単位を付けた表示用文字列を組み立てる。 */
export function formatMaterialQty(qty, baseUnit) {
  return `${qty}${materialUnitLabel(baseUnit)}`;
}

/** 商品の数量に、単位を付けた表示用文字列を組み立てる。 */
export function formatItemQty(qty) {
  return `${qty}${itemUnitLabel()}`;
}

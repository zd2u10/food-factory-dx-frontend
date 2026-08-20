/**
 * 選んだ材料の梱包仕様(specs)から、産地(または梱包仕様)のグループ選択肢を組み立てる。
 * 発注フォーム(ProcurementPage)と在庫画面(InventoryPage)の両方で使う共通ロジック。
 *
 * 【原料の場合】
 * canMix=trueの産地同士は、重量+単位が完全に一致するものだけを自動的にグループ化し、
 * 「愛知or三重」のように1つの単位としてまとめる(要件定義で確定した設計)。
 * canMix=falseの産地(例: 特別レシピ用の山梨)は、重量が他と同じであっても、
 * 常に単独の選択肢として扱う。
 *
 * 【添加物の場合】
 * 産地という概念自体が無いため、can_mixによるグループ化は行わず、
 * 登録されている梱包仕様(重量+単位)を、そのまま1つずつ選択肢にする。
 *
 * 戻り値: [{ key, label, origins, packageWeight, packageUnitLabel, labelIncludesWeight }, ...]
 */
export function buildOriginGroups(specs, isRaw) {
  if (!isRaw) {
    return specs.map((spec) => ({
      key: `fixed-${spec.specId}`,
      label: `${spec.packageWeight} / ${spec.packageUnitLabel}`,
      labelIncludesWeight: true,
      origins: [spec.origin],
      packageWeight: spec.packageWeight,
      packageUnitLabel: spec.packageUnitLabel,
    }));
  }

  const mixable = specs.filter((s) => s.canMix);
  const fixed = specs.filter((s) => !s.canMix);

  const groupMap = new Map();
  for (const spec of mixable) {
    const key = `${spec.packageWeight}-${spec.packageUnitLabel}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { origins: [], packageWeight: spec.packageWeight, packageUnitLabel: spec.packageUnitLabel });
    }
    groupMap.get(key).origins.push(spec.origin);
  }

  const groups = Array.from(groupMap.entries()).map(([key, g]) => ({
    key,
    label: g.origins.join('or'),
    labelIncludesWeight: false,
    origins: g.origins,
    packageWeight: g.packageWeight,
    packageUnitLabel: g.packageUnitLabel,
  }));

  const fixedGroups = fixed.map((spec) => ({
    key: `fixed-${spec.specId}`,
    label: spec.origin,
    labelIncludesWeight: false,
    origins: [spec.origin],
    packageWeight: spec.packageWeight,
    packageUnitLabel: spec.packageUnitLabel,
  }));

  return [...groups, ...fixedGroups];
}

/**
 * 材料の産地グループの中に、指定したorigin(産地名)が含まれるグループを探す。
 * 在庫画面で、ロットのoriginから、どのグループに属するかを判定するために使う。
 */
export function findGroupForOrigin(groups, origin) {
  return groups.find((g) => g.origins.includes(origin));
}

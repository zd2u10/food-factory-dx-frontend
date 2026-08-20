import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listMaterials } from '../../api/materialApi.js';
import { listPackageSpecs } from '../../api/packageSpecApi.js';
import { listMaterialLots } from '../../api/materialLotApi.js';
import { listBatches } from '../../api/manufacturingApi.js';
import { listItems } from '../../api/itemApi.js';
import { buildOriginGroups } from '../../utils/originGrouping.js';
import { materialUnitLabel, itemUnitLabel } from '../../utils/unitLabel.js';

/**
 * 在庫画面。材料在庫(産地グループ単位)・商品在庫(商品単位)の2タブ構成。
 *
 * 【材料在庫の設計】原料は「材料 × 産地グループ(can_mixで自動グループ化)」ごとに合算する。
 * 米粉のうち愛知・三重(通常レシピ用)と新潟(特別レシピ用)は用途が異なるため、
 * 合算すると実際に使える量が分からなくなってしまうため、産地グループ単位で分ける
 * (発注フォームで使っているのと同じグループ化ロジックを再利用している)。
 * 添加物は産地の概念が無いため、材料ごとにそのまま合算する。
 */
export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState('material');

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-4">在庫</h1>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'material' ? 'active' : ''}`}
            onClick={() => setActiveTab('material')}
          >
            材料在庫
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'item' ? 'active' : ''}`}
            onClick={() => setActiveTab('item')}
          >
            商品在庫
          </button>
        </li>
      </ul>

      {activeTab === 'material' ? <MaterialInventoryTab /> : <ItemInventoryTab />}
    </div>
  );
}

function MaterialInventoryTab() {
  const [expandedKey, setExpandedKey] = useState(null);

  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: lots = [], isLoading } = useQuery({
    queryKey: ['materialLots', 'all'],
    queryFn: () => listMaterialLots(),
  });

  const materialIds = [...new Set(lots.map((l) => l.materialId))];

  if (isLoading) return <p className="text-muted">読み込み中...</p>;
  if (materialIds.length === 0) return <p className="text-muted">在庫がある材料はありません。</p>;

  return (
    <div className="d-flex flex-column gap-3">
      {materialIds.map((materialId) => (
        <MaterialGroupSection
          key={materialId}
          materialId={materialId}
          material={materials.find((m) => m.materialId === materialId)}
          lots={lots.filter((l) => l.materialId === materialId)}
          expandedKey={expandedKey}
          onToggleExpand={setExpandedKey}
        />
      ))}
    </div>
  );
}

/** 1つの材料について、産地グループ(または添加物なら材料そのもの)ごとの在庫を表示する。 */
function MaterialGroupSection({ materialId, material, lots, expandedKey, onToggleExpand }) {
  const isRaw = material?.category === 'RAW';

  const { data: specs = [] } = useQuery({
    queryKey: ['packageSpecs', materialId],
    queryFn: () => listPackageSpecs(materialId),
  });

  const groups = buildOriginGroups(specs, isRaw);

  const groupSummaries = isRaw
    ? groups
        .map((group) => {
          const groupLots = lots.filter((lot) => group.origins.includes(lot.origin));
          const totalQty = groupLots.reduce((sum, lot) => sum + Number(lot.remainingQty), 0);
          return { group, lots: groupLots, totalQty };
        })
        .filter((g) => g.totalQty > 0)
    : [
        {
          group: { key: `material-${materialId}`, label: material?.name ?? `材料ID:${materialId}` },
          lots,
          totalQty: lots.reduce((sum, lot) => sum + Number(lot.remainingQty), 0),
        },
      ];

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h6 card-title">{material?.name ?? `材料ID:${materialId}`}</h2>
        <div className="d-flex flex-column gap-2">
          {groupSummaries.map(({ group, lots: groupLots, totalQty }) => {
            const key = `${materialId}-${group.key}`;
            const isExpanded = expandedKey === key;
            return (
              <div key={key} className="border rounded p-2">
                <div className="d-flex justify-content-between align-items-center">
                  <span>
                    {isRaw ? group.label : '在庫'}: <strong>{totalQty}{materialUnitLabel(material?.baseUnit)}</strong>
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onToggleExpand(isExpanded ? null : key)}
                  >
                    {isExpanded ? '内訳を閉じる' : '内訳を見る'}
                  </button>
                </div>
                {isExpanded && (
                  <table className="table table-sm table-striped mt-2 mb-0">
                    <thead>
                      <tr>
                        <th>ロット番号</th>
                        {isRaw && <th>産地</th>}
                        <th>賞味期限</th>
                        <th>残量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupLots
                        .slice()
                        .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1))
                        .map((lot) => (
                          <tr key={lot.lotId}>
                            <td>{lot.supplierLotNo}</td>
                            {isRaw && <td>{lot.origin}</td>}
                            <td>{lot.expiryDate}</td>
                            <td>{lot.remainingQty}{materialUnitLabel(material?.baseUnit)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ItemInventoryTab() {
  const [expandedItemId, setExpandedItemId] = useState(null);

  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });
  const { data: batches = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: listBatches });

  const completedBatches = batches.filter((b) => b.status === 'COMPLETED' && Number(b.remainingQty) > 0);
  const itemIds = [...new Set(completedBatches.map((b) => b.itemId))];

  if (isLoading) return <p className="text-muted">読み込み中...</p>;
  if (itemIds.length === 0) return <p className="text-muted">在庫がある商品はありません。</p>;

  return (
    <div className="d-flex flex-column gap-3">
      {itemIds.map((itemId) => {
        const itemBatches = completedBatches.filter((b) => b.itemId === itemId);
        const totalQty = itemBatches.reduce((sum, b) => sum + Number(b.remainingQty), 0);
        const itemName = items.find((i) => i.itemId === itemId)?.name ?? `商品ID:${itemId}`;
        const isExpanded = expandedItemId === itemId;

        return (
          <div className="card" key={itemId}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <h2 className="h6 card-title mb-0">
                  {itemName}: <strong>{totalQty}{itemUnitLabel()}</strong>
                </h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setExpandedItemId(isExpanded ? null : itemId)}
                >
                  {isExpanded ? '内訳を閉じる' : '内訳を見る'}
                </button>
              </div>
              {isExpanded && (
                <table className="table table-sm table-striped mt-2 mb-0">
                  <thead>
                    <tr>
                      <th>バッチID</th>
                      <th>製造日</th>
                      <th>残数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemBatches
                      .slice()
                      .sort((a, b) => (a.batchDate < b.batchDate ? -1 : 1))
                      .map((batch) => (
                        <tr key={batch.batchId}>
                          <td>{batch.batchId}</td>
                          <td>{batch.batchDate}</td>
                          <td>{batch.remainingQty}{itemUnitLabel()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

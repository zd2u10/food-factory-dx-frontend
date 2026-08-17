import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createMaterialOrder, listMaterialOrders } from '../../api/materialOrderApi.js';
import { listMaterials } from '../../api/materialApi.js';
import { listPackageSpecs } from '../../api/packageSpecApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = { materialId: '', supplierId: '', orderQty: '', orderDate: '', expectedDate: '', origins: [] };

const STATUS_LABEL = {
  NOT_ARRIVED: { text: '未入荷', className: 'text-bg-secondary' },
  PARTIALLY_ARRIVED: { text: '一部入荷', className: 'text-bg-warning' },
  FULLY_ARRIVED: { text: '入荷完了', className: 'text-bg-success' },
};

/**
 * 選んだ材料の梱包仕様(specs)から、発注フォームで表示するチェックボックスの単位を組み立てる。
 *
 * canMix=trueの産地同士は、重量+単位が完全に一致するものだけを自動的にグループ化し、
 * 「愛知or三重」のように1つのチェックボックスとしてまとめる(要件定義で確定した設計)。
 * canMix=falseの産地(例: 特別レシピ用の山梨)は、重量が他と同じであっても、
 * 常に単独のチェックボックスとして扱う。
 *
 * 戻り値: [{ key, label, origins: [そのチェックボックスが表す産地名の配列] }, ...]
 */
function buildOriginGroups(specs) {
  const mixable = specs.filter((s) => s.canMix);
  const fixed = specs.filter((s) => !s.canMix);

  // canMix=trueの産地を、「重量+単位」が完全一致するものごとにグループ化する。
  const groupMap = new Map(); // key: "15000-袋" のような文字列 → { origins: [], packageWeight, packageUnitLabel }
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
    origins: g.origins,
    packageWeight: g.packageWeight,
    packageUnitLabel: g.packageUnitLabel,
  }));

  const fixedGroups = fixed.map((spec) => ({
    key: `fixed-${spec.specId}`,
    label: spec.origin,
    origins: [spec.origin],
    packageWeight: spec.packageWeight,
    packageUnitLabel: spec.packageUnitLabel,
  }));

  return [...groups, ...fixedGroups];
}

/**
 * 発注の一覧・登録画面。
 * 材料はIDではなく名前で選ぶ(プルダウン)。産地は、原料の場合のみ
 * 「複数の産地が混在する可能性はありますか?」(can_mix)を基準に自動グループ化されたチェックボックスで選ぶ。
 * 添加物には産地の概念が無いため、産地選択欄自体を表示しない。
 */
export default function ProcurementPage() {
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [showForm, setShowForm] = useState(false); // 「新規発注」フォームの開閉状態。ボタンを押した時だけ表示する

  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['materialOrders'],
    queryFn: listMaterialOrders,
  });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });

  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
  }

  const createMutation = useMutation({
    mutationFn: createMaterialOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialOrders'] });
      setShowForm(false);
    },
  });

  function handleRequestSubmit(formValues) {
    setPendingSubmit({
      materialId: Number(formValues.materialId),
      supplierId: formValues.supplierId,
      orderQty: Number(formValues.orderQty),
      // 産地を1件も選ばなかった場合(添加物、または原料でも絞り込まない場合)はnullとして送る。
      allowedOrigins: formValues.origins.length > 0 ? formValues.origins.join(',') : null,
      orderDate: formValues.orderDate,
      expectedDate: formValues.expectedDate || null,
    });
  }

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-4">発注・入荷</h1>

      <div className="d-flex gap-2 mb-4">
        <Link to="/procurement/arrivals/new" className="btn btn-outline-primary">
          入荷を登録する(発注に紐づかない緊急入荷も可)
        </Link>
        <Link to="/procurement/holds" className="btn btn-outline-warning">
          保留対応一覧
        </Link>
        <button type="button" className="btn btn-success ms-auto" onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? 'フォームを閉じる' : '+ 新規発注'}
        </button>
      </div>

      {error && <div className="alert alert-danger">{error.message}</div>}
      {createMutation.error && <div className="alert alert-danger">{createMutation.error.message}</div>}

      {showForm && (
        <div className="row mb-4">
          <div className="col-12 col-lg-6">
            <OrderForm materials={materials} onSubmit={handleRequestSubmit} isSaving={createMutation.isPending} />
          </div>
        </div>
      )}

      <div>
        <h2 className="h5 mb-3">発注一覧</h2>
        {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : (
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>材料</th>
                  <th>仕入先</th>
                  <th>発注数量</th>
                  <th>許可産地</th>
                  <th>発注日</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted">
                      まだ発注が登録されていません
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const statusInfo = STATUS_LABEL[order.status] ?? { text: order.status, className: 'text-bg-secondary' };
                    return (
                      <tr key={order.orderId}>
                        <td>{order.orderId}</td>
                        <td>{materialName(order.materialId)}</td>
                        <td>{order.supplierId}</td>
                        <td>{order.orderQty}</td>
                        <td>{order.allowedOrigins || '(指定なし)'}</td>
                        <td>{order.orderDate}</td>
                        <td>
                          <span className={`badge ${statusInfo.className}`}>{statusInfo.text}</span>
                        </td>
                        <td>
                          <div className="btn-group btn-group-sm">
                            <Link to={`/procurement/orders/${order.orderId}`} className="btn btn-outline-secondary">
                              入荷状況
                            </Link>
                            {order.status !== 'FULLY_ARRIVED' && (
                              <Link
                                to={`/procurement/orders/${order.orderId}/arrivals/new`}
                                className="btn btn-outline-primary"
                              >
                                入荷登録
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
      </div>

      <ConfirmModal
        show={pendingSubmit !== null}
        title="この内容で発注を登録します"
        confirmLabel="登録する"
        summaryLines={
          pendingSubmit
            ? [
                { label: '材料', value: materialName(pendingSubmit.materialId) },
                { label: '仕入先', value: pendingSubmit.supplierId },
                { label: '発注数量', value: pendingSubmit.orderQty },
                { label: '許可産地', value: pendingSubmit.allowedOrigins ?? '(指定なし)' },
                { label: '発注日', value: pendingSubmit.orderDate },
                { label: '納品予定日', value: pendingSubmit.expectedDate ?? '(未定)' },
              ]
            : []
        }
        onConfirm={() => {
          createMutation.mutate(pendingSubmit);
          setPendingSubmit(null);
        }}
        onCancel={() => setPendingSubmit(null)}
      />
    </div>
  );
}

function OrderForm({ materials, onSubmit, isSaving }) {
  const [form, setForm] = useState(emptyForm);

  const selectedMaterial = materials.find((m) => m.materialId === Number(form.materialId));
  const isRaw = selectedMaterial?.category === 'RAW';

  const { data: specs = [] } = useQuery({
    queryKey: ['packageSpecs', form.materialId],
    queryFn: () => listPackageSpecs(form.materialId),
    enabled: isRaw && !!form.materialId,
  });

  const originGroups = isRaw ? buildOriginGroups(specs) : [];

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleMaterialChange(value) {
    setForm((prev) => ({ ...prev, materialId: value, origins: [] }));
  }

  function toggleGroup(group, checked) {
    setForm((prev) => {
      const next = checked
        ? Array.from(new Set([...prev.origins, ...group.origins]))
        : prev.origins.filter((o) => !group.origins.includes(o));
      return { ...prev, origins: next };
    });
  }

  function isGroupChecked(group) {
    return group.origins.every((o) => form.origins.includes(o));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
    setForm(emptyForm);
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">新規発注</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">材料</label>
            <select
              name="materialId"
              className="form-select"
              value={form.materialId}
              onChange={(e) => handleMaterialChange(e.target.value)}
              required
            >
              <option value="" disabled>
                選択してください
              </option>
              {materials.map((m) => (
                <option key={m.materialId} value={m.materialId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {isRaw && (
            <div className="mb-3">
              <label className="form-label d-block">
                許可する産地(任意。指定しなければ産地を問いません)
              </label>
              {originGroups.length === 0 ? (
                <div className="form-text text-warning">
                  この材料にはまだ産地が登録されていません。「マスタ管理」→「材料」→「産地管理」から登録してください。
                </div>
              ) : (
                <div className="d-flex flex-column gap-1">
                  {originGroups.map((group) => (
                    <div className="form-check" key={group.key}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`origin-group-${group.key}`}
                        checked={isGroupChecked(group)}
                        onChange={(e) => toggleGroup(group, e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor={`origin-group-${group.key}`}>
                        {group.label}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">仕入先</label>
            <input
              name="supplierId"
              type="text"
              className="form-control"
              value={form.supplierId}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">発注数量(g/ml)</label>
            <input
              name="orderQty"
              type="number"
              min="0"
              className="form-control"
              value={form.orderQty}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">発注日</label>
            <input
              name="orderDate"
              type="date"
              className="form-control"
              value={form.orderDate}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">納品予定日(任意)</label>
            <input
              name="expectedDate"
              type="date"
              className="form-control"
              value={form.expectedDate}
              onChange={handleChange}
            />
            <div className="form-text">仕入先から明言されない場合は空欄のままで構いません。</div>
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={isSaving}>
            {isSaving ? '送信中...' : '登録する'}
          </button>
        </form>
      </div>
    </div>
  );
}

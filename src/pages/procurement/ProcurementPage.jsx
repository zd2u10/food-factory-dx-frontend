import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createMaterialOrder, listMaterialOrders } from '../../api/materialOrderApi.js';
import { listMaterials } from '../../api/materialApi.js';
import { listPackageSpecs } from '../../api/packageSpecApi.js';
import { listSuppliers } from '../../api/supplierApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { buildOriginGroups } from '../../utils/originGrouping.js';
import { materialUnitLabel } from '../../utils/unitLabel.js';

const emptyForm = {
  materialId: '',
  supplierId: '',
  selectedGroupKey: '', // 選んだ産地グループ(原料)または梱包仕様(添加物)のkey
  packageQty: '', // パッケージ数量(人が入力する。ここから合計量を自動計算する)
  orderDate: '',
  expectedDate: '',
};

const STATUS_LABEL = {
  NOT_ARRIVED: { text: '未入荷', className: 'text-bg-secondary' },
  PARTIALLY_ARRIVED: { text: '一部入荷', className: 'text-bg-warning' },
  FULLY_ARRIVED: { text: '入荷完了', className: 'text-bg-success' },
};

/**
 * 発注の一覧・登録画面。
 * 材料はIDではなく名前で選ぶ(プルダウン)。産地は、原料の場合のみ
 * 「複数の産地が混在する可能性はありますか?」(can_mix)を基準に自動グループ化されたチェックボックスで選ぶ。
 * 添加物には産地の概念が無いため、産地選択欄自体を表示しない。
 */
export default function ProcurementPage() {
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [showForm, setShowForm] = useState(false); // 「新規発注」フォームの開閉状態。ボタンを押した時だけ表示する

  // 発注一覧の絞り込み条件。全て任意で、組み合わせて絞り込める。
  // 材料と仕入先は実務上1:1で固定(メーカーから直接仕入れており、商社を介さないため)なので、
  // 「材料」を選べば実質的に仕入先も絞り込んだことになる。そのため仕入先は独立したフィルターにしない。
  const [filters, setFilters] = useState({
    materialId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });

  const queryClient = useQueryClient();

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ['materialOrders'],
    queryFn: listMaterialOrders,
  });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => listSuppliers() });

  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
  }

  function materialUnit(materialId) {
    return materialUnitLabel(materials.find((m) => m.materialId === materialId)?.baseUnit);
  }

  function supplierName(supplierId) {
    return suppliers.find((s) => s.supplierId === supplierId)?.name ?? `仕入先ID:${supplierId}`;
  }

  // フィルター条件に合致する発注だけを残す。空欄の条件は絞り込みに使わない。
  const filteredOrders = orders.filter((order) => {
    if (filters.materialId && order.materialId !== Number(filters.materialId)) return false;
    if (filters.status && order.status !== filters.status) return false;
    if (filters.dateFrom && order.orderDate < filters.dateFrom) return false;
    if (filters.dateTo && order.orderDate > filters.dateTo) return false;
    return true;
  });

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setFilters({ materialId: '', status: '', dateFrom: '', dateTo: '' });
  }

  const [formResetKey, setFormResetKey] = useState(0); // 登録成功時だけ増やし、OrderFormを再マウントしてリセットする

  const createMutation = useMutation({
    mutationFn: createMaterialOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialOrders'] });
      setShowForm(false);
      setFormResetKey((prev) => prev + 1); // ここで初めてフォームをリセットする(エラー時はリセットしない)
    },
  });

  function handleRequestSubmit(formValues) {
    setPendingSubmit({
      materialId: Number(formValues.materialId),
      supplierId: Number(formValues.supplierId),
      orderQty: formValues.orderQty, // OrderForm側で「パッケージ数量 × 梱包重量」から既に計算済み
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
        <Link to="/procurement/arrivals/new" className="btn btn-primary">
          予定外の入荷を登録する
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
            <OrderForm
              key={formResetKey}
              materials={materials}
              suppliers={suppliers}
              onSubmit={handleRequestSubmit}
              isSaving={createMutation.isPending}
            />
          </div>
        </div>
      )}

      <div>
        <h2 className="h5 mb-3">発注一覧</h2>

        <div className="row g-2 mb-3 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label small">材料</label>
            <select
              name="materialId"
              className="form-select form-select-sm"
              value={filters.materialId}
              onChange={handleFilterChange}
            >
              <option value="">すべて</option>
              {materials.map((m) => (
                <option key={m.materialId} value={m.materialId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small">状態</label>
            <select
              name="status"
              className="form-select form-select-sm"
              value={filters.status}
              onChange={handleFilterChange}
            >
              <option value="">すべて</option>
              <option value="NOT_ARRIVED">未入荷</option>
              <option value="PARTIALLY_ARRIVED">一部入荷</option>
              <option value="FULLY_ARRIVED">入荷完了</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small">発注日(開始)</label>
            <input
              type="date"
              name="dateFrom"
              className="form-control form-control-sm"
              value={filters.dateFrom}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small">発注日(終了)</label>
            <input
              type="date"
              name="dateTo"
              className="form-control form-control-sm"
              value={filters.dateTo}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-6 col-md-3">
            <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={clearFilters}>
              条件をクリア
            </button>
          </div>
        </div>

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
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted">
                      {orders.length === 0 ? 'まだ発注が登録されていません' : '条件に合う発注がありません'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <OrderRow
                      key={order.orderId}
                      order={order}
                      materials={materials}
                      materialName={materialName}
                      supplierName={supplierName}
                    />
                  ))
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
                { label: '仕入先', value: supplierName(pendingSubmit.supplierId) },
                { label: '発注数量', value: `${pendingSubmit.orderQty}${materialUnit(pendingSubmit.materialId)}` },
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

/**
 * 発注一覧の1行分。発注数量(g/ml)を、その材料の梱包仕様(spec)を使って
 * パッケージ数表示に変換する。
 *
 * 基準にするspecの選び方:
 *   1. allowedOriginsが指定されていれば、その産地(先頭の1つ)に対応するspecを使う
 *   2. 指定が無ければ(添加物、または移行前の古いデータ)、
 *      その材料に登録されているspecのうち代表(先頭)の1件を使う
 *   3. specが1件も無い場合は、これまで通り重量(g/ml)のまま表示する
 */
function OrderRow({ order, materials, materialName, supplierName }) {
  const { data: specs = [] } = useQuery({
    queryKey: ['packageSpecs', order.materialId],
    queryFn: () => listPackageSpecs(order.materialId),
  });

  const material = materials.find((m) => m.materialId === order.materialId);
  const isRaw = material?.category === 'RAW';

  const statusInfo = STATUS_LABEL[order.status] ?? { text: order.status, className: 'text-bg-secondary' };

  const firstOrigin = order.allowedOrigins ? order.allowedOrigins.split(',')[0] : null;
  const matchedSpec = firstOrigin ? specs.find((s) => s.origin === firstOrigin) : null;
  const representativeSpec = matchedSpec ?? specs[0] ?? null;

  const qtyDisplay = representativeSpec
    ? `${Math.round(Number(order.orderQty) / Number(representativeSpec.packageWeight))}${representativeSpec.packageUnitLabel}`
    : `${order.orderQty}${materialUnitLabel(material?.baseUnit)}`;

  // allowedOriginsの中身は、添加物の場合「spec-xxxxxxxx」という内部識別用の値であり、
  // 人が見て意味のあるものではないため表示しない。原料の場合のみ、実際の産地名を表示する。
  const originDisplay = isRaw ? (order.allowedOrigins || '(指定なし)') : '-';

  return (
    <tr>
      <td>{order.orderId}</td>
      <td>{materialName(order.materialId)}</td>
      <td>{supplierName(order.supplierId)}</td>
      <td>{qtyDisplay}</td>
      <td>{originDisplay}</td>
      <td>{order.orderDate}</td>
      <td>
        <span className={`badge ${statusInfo.className}`}>{statusInfo.text}</span>
        {order.hasHoldHistory && (
          <span className="badge text-bg-warning ms-1" title="この発注では、過去に保留が発生しています">
            ⚠ 保留対応あり
          </span>
        )}
      </td>
      <td>
        <div className="btn-group btn-group-sm gap-2">
          <Link to={`/procurement/orders/${order.orderId}`} className="btn btn-secondary">
            入荷状況
          </Link>
          {order.status !== 'FULLY_ARRIVED' && (
            <Link to={`/procurement/orders/${order.orderId}/arrivals/new`} className="btn btn-primary">
              入荷登録
            </Link>
          )}
        </div>
      </td>
    </tr>
  );
}

function OrderForm({ materials, suppliers, onSubmit, isSaving }) {
  const [form, setForm] = useState(emptyForm);

  const selectedMaterial = materials.find((m) => m.materialId === Number(form.materialId));
  const isRaw = selectedMaterial?.category === 'RAW';

  // 添加物にも梱包仕様は必要なため、原料かどうかにかかわらずspecsを取得する。
  const { data: specs = [] } = useQuery({
    queryKey: ['packageSpecs', form.materialId],
    queryFn: () => listPackageSpecs(form.materialId),
    enabled: !!form.materialId,
  });

  const groups = buildOriginGroups(specs, isRaw);
  const selectedGroup = groups.find((g) => g.key === form.selectedGroupKey);
  const orderQty = selectedGroup && form.packageQty
    ? Number(form.packageQty) * Number(selectedGroup.packageWeight)
    : null;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleMaterialChange(value) {
    setForm((prev) => ({ ...prev, materialId: value, selectedGroupKey: '', packageQty: '' }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit({
      materialId: form.materialId,
      supplierId: form.supplierId,
      orderQty,
      origins: selectedGroup ? selectedGroup.origins : [],
      orderDate: form.orderDate,
      expectedDate: form.expectedDate,
    });
    // ここでは setForm(emptyForm) を呼ばない。
    // これは「確認モーダルを開く」段階であり、まだ登録が完了していないため。
    // 実際の登録が成功した時だけ、親コンポーネント側でformResetKeyを更新し、
    // このコンポーネントごと再マウントすることでリセットする(エラー時は入力内容を保持する)。
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

          <div className="mb-3">
            <label className="form-label">仕入先</label>
            <select
              name="supplierId"
              className="form-select"
              value={form.supplierId}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                選択してください
              </option>
              {suppliers.map((s) => (
                <option key={s.supplierId} value={s.supplierId}>
                  {s.name}
                </option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <div className="form-text text-warning">
                仕入先が登録されていません。「マスタ管理」→「仕入先」から登録してください。
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">{isRaw ? '産地(許可する範囲)' : '梱包仕様'}</label>
            <select
              name="selectedGroupKey"
              className="form-select"
              value={form.selectedGroupKey}
              onChange={handleChange}
              disabled={!form.materialId}
              required
            >
              <option value="" disabled>
                {form.materialId ? '選択してください' : '先に材料を選んでください'}
              </option>
              {groups.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.labelIncludesWeight
                    ? group.label
                    : `${group.label}(${group.packageWeight} / ${group.packageUnitLabel})`}
                </option>
              ))}
            </select>
            {form.materialId && groups.length === 0 && (
              <div className="form-text text-warning">
                この材料にはまだ{isRaw ? '産地' : '梱包仕様'}が登録されていません。「マスタ管理」→「材料」→「
                {isRaw ? '産地管理' : '梱包仕様管理'}」から登録してください。
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label">
              パッケージ数量{selectedGroup ? `(${selectedGroup.packageUnitLabel})` : ''}
            </label>
            <input
              name="packageQty"
              type="number"
              min="0"
              className="form-control"
              value={form.packageQty}
              onChange={handleChange}
              disabled={!selectedGroup}
              required
            />
            {selectedGroup && (
              <div className="form-text">
                合計量(自動計算): {orderQty ?? 0}{materialUnitLabel(selectedMaterial?.baseUnit)}
                (1{selectedGroup.packageUnitLabel} = {selectedGroup.packageWeight}{materialUnitLabel(selectedMaterial?.baseUnit)}として計算)
              </div>
            )}
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
          <button type="submit" className="btn btn-primary w-100" disabled={isSaving || !orderQty}>
            {isSaving ? '送信中...' : '登録する'}
          </button>
        </form>
      </div>
    </div>
  );
}

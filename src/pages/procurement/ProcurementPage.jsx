import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createMaterialOrder, listMaterialOrders } from '../../api/materialOrderApi.js';
import { listMaterials } from '../../api/materialApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = { materialId: '', supplierId: '', orderQty: '', orderDate: '', expectedDate: '' };

const STATUS_LABEL = {
  NOT_ARRIVED: { text: '未入荷', className: 'text-bg-secondary' },
  PARTIALLY_ARRIVED: { text: '一部入荷', className: 'text-bg-warning' },
  FULLY_ARRIVED: { text: '入荷完了', className: 'text-bg-success' },
};

/**
 * 発注の一覧・登録画面。
 * 材料はIDではなく名前で選ぶ(プルダウン)。IDはあくまでシステム内部の管理番号であり、
 * 人が手入力・記憶するものではないという方針(フェーズ1実装時に確認済み)。
 */
export default function ProcurementPage() {
  const [pendingSubmit, setPendingSubmit] = useState(null);

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materialOrders'] }),
  });

  function handleRequestSubmit(formValues) {
    setPendingSubmit({
      materialId: Number(formValues.materialId),
      supplierId: formValues.supplierId,
      orderQty: Number(formValues.orderQty),
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
      </div>

      {error && <div className="alert alert-danger">{error.message}</div>}
      {createMutation.error && <div className="alert alert-danger">{createMutation.error.message}</div>}

      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <OrderForm materials={materials} onSubmit={handleRequestSubmit} isSaving={createMutation.isPending} />
        </div>

        <div className="col-12 col-lg-8">
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
                  <th>発注日</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
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
                        <td>{order.orderDate}</td>
                        <td>
                          <span className={`badge ${statusInfo.className}`}>{statusInfo.text}</span>
                        </td>
                        <td>
                          <Link to={`/procurement/orders/${order.orderId}`} className="btn btn-outline-secondary btn-sm">
                            入荷状況
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
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

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
            <select name="materialId" className="form-select" value={form.materialId} onChange={handleChange} required>
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

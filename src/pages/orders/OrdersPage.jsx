import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  listCustomerOrders,
  createCustomerOrder,
  cancelCustomerOrder,
  listOrderLines,
  createOrderLine,
  updateOrderLine,
} from '../../api/customerOrderApi.js';
import { listShipments } from '../../api/shipmentApi.js';
import { runMrp } from '../../api/manufacturingApi.js';
import { listCarriers } from '../../api/carrierApi.js';
import { listCustomers } from '../../api/customerApi.js';
import { listItems } from '../../api/itemApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';
import { itemUnitLabel } from '../../utils/unitLabel.js';

const STATUS_LABEL = {
  NEW: { text: '受注受付', className: 'text-bg-secondary' },
  CONFIRMED: { text: '確定', className: 'text-bg-info' },
  PARTIALLY_SHIPPED: { text: '一部出荷', className: 'text-bg-warning' },
  COMPLETED: { text: '出荷完了', className: 'text-bg-success' },
  CANCELLED: { text: 'キャンセル', className: 'text-bg-secondary' },
};

/**
 * 受注・出荷ページ。タブで「受注一覧」「出荷一覧」を切り替える。
 * 受注一覧は、受注ヘッダー(customer_order)+明細(order_line)を、
 * マスタ画面と同じ開閉フォームパターンで登録・編集する。
 */
export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState('orders');

  return (
    <div className="container-fluid py-4">
      <h1 className="h3 mb-4">受注・出荷</h1>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            受注一覧
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'shipments' ? 'active' : ''}`}
            onClick={() => setActiveTab('shipments')}
          >
            出荷一覧
          </button>
        </li>
      </ul>

      {activeTab === 'orders' ? <OrdersTab /> : <ShipmentsTab />}
    </div>
  );
}

function OrdersTab() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [pendingCancelId, setPendingCancelId] = useState(null);

  // 絞り込み条件。取引先はB2B/B2Cを問わず件数が多くなりうるため、
  // セレクトボックスではなくオートコンプリート(datalist)による名前検索にしている。
  const [filters, setFilters] = useState({
    customerName: '',
    itemId: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });

  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['customerOrders'], queryFn: listCustomerOrders });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: listCustomers });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: () => listItems() });

  function customerName(customerId) {
    return customers.find((c) => c.customerId === customerId)?.name ?? `取引先ID:${customerId}`;
  }

  // 商品による絞り込みは、受注明細(order_line)側の情報のため、
  // 一覧表示用に各受注の明細を都度取得するのはコストが高い。
  // ここでは簡易的に、フィルター用に全受注の明細を一括取得して突き合わせる。
  const { data: allLinesMap = {} } = useQuery({
    queryKey: ['allOrderLinesForFilter', orders.map((o) => o.orderId).join(',')],
    queryFn: async () => {
      const map = {};
      await Promise.all(
        orders.map(async (o) => {
          map[o.orderId] = await listOrderLines(o.orderId);
        })
      );
      return map;
    },
    enabled: orders.length > 0 && !!filters.itemId, // 商品フィルターを使う時だけ取得する(無駄な通信を避ける)
  });

  const filteredOrders = orders.filter((order) => {
    if (filters.customerName && !customerName(order.customerId).includes(filters.customerName)) return false;
    if (filters.status && order.status !== filters.status) return false;
    if (filters.dateFrom && order.orderDate < filters.dateFrom) return false;
    if (filters.dateTo && order.orderDate > filters.dateTo) return false;
    if (filters.itemId) {
      const lines = allLinesMap[order.orderId] ?? [];
      if (!lines.some((l) => l.itemId === Number(filters.itemId))) return false;
    }
    return true;
  });

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setFilters({ customerName: '', itemId: '', status: '', dateFrom: '', dateTo: '' });
  }

  const cancelMutation = useMutation({
    mutationFn: cancelCustomerOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerOrders'] });
      setPendingCancelId(null);
    },
  });

  const mrpMutation = useMutation({
    mutationFn: runMrp,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerOrders'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      // 受注管理者が「受注入力を終えてMRPを実行する」場面では、
      // 実行直後に一番見たいのは結果(製造カレンダー)であるため、自動的に遷移する。
      navigate('/manufacturing');
    },
  });

  return (
    <div>
      <div className="d-flex gap-2 mb-3">
        <button type="button" className="btn btn-success" onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? 'フォームを閉じる' : '+ 新規受注登録'}
        </button>
        {/* 受注を作った直後、その場で製造予定に変換できるよう、ここにもMRP実行を置く
            (カレンダー画面側にも同じ処理のボタンを置いており、どちらから実行しても同じ結果になる)。 */}
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => mrpMutation.mutate()}
          disabled={mrpMutation.isPending}
        >
          {mrpMutation.isPending ? '実行中...' : '受注をもとに、製造予定を作成する'}
        </button>
      </div>
      {mrpMutation.isSuccess && (
        <div className="alert alert-success">
          製造予定を作成しました({mrpMutation.data?.length ?? 0}件のバッチが生成されました)。
        </div>
      )}

      <div className="row g-4">
        {showForm && (
          <div className="col-12 col-lg-5">
            <NewOrderForm
              customers={customers}
              items={items}
              onDone={() => setShowForm(false)}
            />
          </div>
        )}

        <div className={showForm ? 'col-12 col-lg-7' : 'col-12'}>
          <h2 className="h5 mb-3">登録済み受注一覧</h2>

          <div className="row g-2 mb-3 align-items-end">
            <div className="col-6 col-md-3">
              <label className="form-label small">取引先(名前で検索)</label>
              <input
                type="text"
                name="customerName"
                list="customer-name-options"
                className="form-control form-control-sm"
                placeholder="例: 山田"
                value={filters.customerName}
                onChange={handleFilterChange}
              />
              {/* datalistによるオートコンプリート。件数が多いB2C顧客まで想定し、
                  セレクトボックスではなく名前の一部入力で絞り込む方式にしている。 */}
              <datalist id="customer-name-options">
                {customers.map((c) => (
                  <option key={c.customerId} value={c.name} />
                ))}
              </datalist>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small">商品</label>
              <select name="itemId" className="form-select form-select-sm" value={filters.itemId} onChange={handleFilterChange}>
                <option value="">すべて</option>
                {items.map((it) => (
                  <option key={it.itemId} value={it.itemId}>
                    {it.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small">状態</label>
              <select name="status" className="form-select form-select-sm" value={filters.status} onChange={handleFilterChange}>
                <option value="">すべて</option>
                <option value="NEW">受注受付</option>
                <option value="CONFIRMED">確定</option>
                <option value="PARTIALLY_SHIPPED">一部出荷</option>
                <option value="COMPLETED">出荷完了</option>
                <option value="CANCELLED">キャンセル</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small">受注日(開始)</label>
              <input
                type="date"
                name="dateFrom"
                className="form-control form-control-sm"
                value={filters.dateFrom}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small">受注日(終了)</label>
              <input
                type="date"
                name="dateTo"
                className="form-control form-control-sm"
                value={filters.dateTo}
                onChange={handleFilterChange}
              />
            </div>
            <div className="col-6 col-md-1">
              <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={clearFilters}>
                クリア
              </button>
            </div>
          </div>

          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-muted">
              {orders.length === 0 ? 'まだ受注が登録されていません。' : '条件に合う受注がありません。'}
            </p>
          ) : (
            <div className="d-flex flex-column gap-2">
              {filteredOrders.map((order) => {
                const statusInfo = STATUS_LABEL[order.status] ?? { text: order.status, className: 'text-bg-secondary' };
                const isExpanded = expandedOrderId === order.orderId;
                const canCancel = order.status !== 'COMPLETED' && order.status !== 'CANCELLED';

                return (
                  <div className="card" key={order.orderId}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className={`badge ${statusInfo.className} me-2`}>{statusInfo.text}</span>
                          受注ID{order.orderId}: {customerName(order.customerId)}(受注日: {order.orderDate})
                        </div>
                        <div className="btn-group btn-group-sm gap-2">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)}
                          >
                            {isExpanded ? '明細を閉じる' : '明細・編集'}
                          </button>
                          {canCancel && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => setPendingCancelId(order.orderId)}
                            >
                              キャンセル
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <OrderLinesSection order={order} items={items} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        show={pendingCancelId !== null}
        title="この受注をキャンセルします"
        confirmLabel="キャンセルする"
        summaryLines={[{ label: '受注ID', value: pendingCancelId }]}
        onConfirm={() => cancelMutation.mutate(pendingCancelId)}
        onCancel={() => setPendingCancelId(null)}
      />
    </div>
  );
}

/** 新規受注フォーム。取引先を選び、複数の商品明細をまとめて登録する。 */
function NewOrderForm({ customers, items, onDone }) {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [lines, setLines] = useState([{ key: crypto.randomUUID(), itemId: '', qty: '' }]);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  const createOrderMutation = useMutation({
    // 【修正履歴】以前はonSuccess内でpendingSubmit.linesを参照していたが、
    // mutate()呼び出し直後にsetPendingSubmit(null)が実行されるため、
    // 非同期処理(onSuccess)が完了する頃にはpendingSubmitが既にnullになっており、
    // "Cannot read properties of null (reading 'lines')"エラーが起きていた。
    // stateに頼らず、mutate()に渡す値(header+lines)の中で全て完結させることで、
    // タイミングのズレそのものを無くす。
    mutationFn: async ({ header, lines }) => {
      const created = await createCustomerOrder(header);
      for (const line of lines) {
        // eslint-disable-next-line no-await-in-loop
        await createOrderLine(created.orderId, { itemId: Number(line.itemId), qty: Number(line.qty) });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customerOrders'] });
      onDone();
    },
  });

  function addLine() {
    setLines((prev) => [...prev, { key: crypto.randomUUID(), itemId: '', qty: '' }]);
  }
  function removeLine(key) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }
  function updateLine(key, patch) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setPendingSubmit({
      header: { customerId: Number(customerId), orderDate },
      lines,
    });
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">新規受注登録</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">取引先</label>
            <select className="form-select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="" disabled>
                選択してください
              </option>
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label">受注日</label>
            <input
              type="date"
              className="form-control"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              required
            />
          </div>

          <label className="form-label d-block">注文内容</label>
          {lines.map((line) => (
            <div className="row g-2 mb-2 align-items-end" key={line.key}>
              <div className="col-6">
                <select
                  className="form-select"
                  value={line.itemId}
                  onChange={(e) => updateLine(line.key, { itemId: e.target.value })}
                  required
                >
                  <option value="" disabled>
                    商品を選択
                  </option>
                  {items.map((it) => (
                    <option key={it.itemId} value={it.itemId}>
                      {it.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-4">
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="form-control"
                  placeholder={`数量(${itemUnitLabel()})`}
                  value={line.qty}
                  onChange={(e) => updateLine(line.key, { qty: e.target.value })}
                  required
                />
              </div>
              <div className="col-2">
                {lines.length > 1 && (
                  <button type="button" className="btn btn-danger w-100" onClick={() => removeLine(line.key)}>
                    削除
                  </button>
                )}
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-secondary btn-sm mb-3" onClick={addLine}>
            + 商品を追加
          </button>

          <button type="submit" className="btn btn-primary w-100" disabled={createOrderMutation.isPending}>
            {createOrderMutation.isPending ? '送信中...' : '登録する'}
          </button>
          {createOrderMutation.error && (
            <div className="alert alert-danger mt-3">{createOrderMutation.error.message}</div>
          )}
        </form>
      </div>

      <ConfirmModal
        show={pendingSubmit !== null}
        title="この内容で受注を登録します"
        confirmLabel="登録する"
        summaryLines={
          pendingSubmit
            ? [
                { label: '取引先', value: customers.find((c) => c.customerId === pendingSubmit.header.customerId)?.name },
                { label: '受注日', value: pendingSubmit.header.orderDate },
                ...pendingSubmit.lines.map((line, index) => ({
                  label: `${index + 1}. ${items.find((it) => it.itemId === Number(line.itemId))?.name}`,
                  value: `${line.qty}${itemUnitLabel()}`,
                })),
              ]
            : []
        }
        onConfirm={() => {
          createOrderMutation.mutate(pendingSubmit);
          setPendingSubmit(null);
        }}
        onCancel={() => setPendingSubmit(null)}
      />
    </div>
  );
}

/**
 * 受注明細の一覧・編集セクション。展開した受注カードの中に表示する。
 * 出荷前の調整に限定: 出荷済み数量を下回る変更は、バックエンド側でエラーになる
 * (Service層のupdateOrderLineで検証済み)。
 */
function OrderLinesSection({ order, items }) {
  const queryClient = useQueryClient();
  const [editingLineId, setEditingLineId] = useState(null);
  const [editForm, setEditForm] = useState({ itemId: '', qty: '' });
  const [pendingEdit, setPendingEdit] = useState(null);
  const [addingLine, setAddingLine] = useState(false);
  const [newLine, setNewLine] = useState({ itemId: '', qty: '' });
  const [pendingAdd, setPendingAdd] = useState(null);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['orderLines', order.orderId],
    queryFn: () => listOrderLines(order.orderId),
  });

  function itemName(itemId) {
    return items.find((it) => it.itemId === itemId)?.name ?? `商品ID:${itemId}`;
  }

  const updateMutation = useMutation({
    mutationFn: ({ lineId, line }) => updateOrderLine(order.orderId, lineId, line),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderLines', order.orderId] });
      setEditingLineId(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (line) => createOrderLine(order.orderId, line),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orderLines', order.orderId] });
      setAddingLine(false);
      setNewLine({ itemId: '', qty: '' });
    },
  });

  const displayError = updateMutation.error?.message || createMutation.error?.message;

  return (
    <div className="mt-3 border-top pt-3">
      {displayError && <div className="alert alert-danger">{displayError}</div>}
      {isLoading ? (
        <p className="text-muted">読み込み中...</p>
      ) : (
        <table className="table table-sm table-striped align-middle">
          <thead>
            <tr>
              <th>商品</th>
              <th>数量</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.lineId}>
                {editingLineId === line.lineId ? (
                  <>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={editForm.itemId}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, itemId: e.target.value }))}
                      >
                        {items.map((it) => (
                          <option key={it.itemId} value={it.itemId}>
                            {it.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-control form-control-sm"
                        value={editForm.qty}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, qty: e.target.value }))}
                      />
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm gap-2">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() =>
                            setPendingEdit({
                              lineId: line.lineId,
                              itemId: Number(editForm.itemId),
                              qty: Number(editForm.qty),
                            })
                          }
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => setEditingLineId(null)}
                        >
                          やめる
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{itemName(line.itemId)}</td>
                    <td>{line.qty}{itemUnitLabel()}</td>
                    <td>
                      {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setEditingLineId(line.lineId);
                            setEditForm({ itemId: line.itemId, qty: line.qty });
                          }}
                        >
                          編集
                        </button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
        addingLine ? (
          <div className="row g-2 align-items-end">
            <div className="col-5">
              <select
                className="form-select form-select-sm"
                value={newLine.itemId}
                onChange={(e) => setNewLine((prev) => ({ ...prev, itemId: e.target.value }))}
              >
                <option value="" disabled>
                  商品を選択
                </option>
                {items.map((it) => (
                  <option key={it.itemId} value={it.itemId}>
                    {it.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-4">
              <input
                type="number"
                min="0"
                step="1"
                className="form-control form-control-sm"
                placeholder="数量"
                value={newLine.qty}
                onChange={(e) => setNewLine((prev) => ({ ...prev, qty: e.target.value }))}
              />
            </div>
            <div className="col-3">
              <button
                type="button"
                className="btn btn-primary btn-sm w-100"
                onClick={() =>
                  setPendingAdd({ itemId: Number(newLine.itemId), qty: Number(newLine.qty) })
                }
              >
                追加
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAddingLine(true)}>
            + 商品を追加
          </button>
        )
      )}

      {order.status !== 'CANCELLED' && (
        <div className="mt-3">
          <Link to={`/orders/${order.orderId}/shipment`} className="btn btn-primary btn-sm">
            出荷処理へ進む
          </Link>
        </div>
      )}

      <ConfirmModal
        show={pendingEdit !== null}
        title="この内容で受注明細を更新します"
        confirmLabel="更新する"
        summaryLines={
          pendingEdit
            ? [
                { label: '商品', value: itemName(pendingEdit.itemId) },
                { label: '数量', value: `${pendingEdit.qty}${itemUnitLabel()}` },
              ]
            : []
        }
        onConfirm={() => {
          updateMutation.mutate({ lineId: pendingEdit.lineId, line: pendingEdit });
          setPendingEdit(null);
        }}
        onCancel={() => setPendingEdit(null)}
      />

      <ConfirmModal
        show={pendingAdd !== null}
        title="この商品を、注文内容に追加します"
        confirmLabel="追加する"
        summaryLines={
          pendingAdd
            ? [
                { label: '商品', value: itemName(pendingAdd.itemId) },
                { label: '数量', value: `${pendingAdd.qty}${itemUnitLabel()}` },
              ]
            : []
        }
        onConfirm={() => {
          createMutation.mutate(pendingAdd);
          setPendingAdd(null);
        }}
        onCancel={() => setPendingAdd(null)}
      />
    </div>
  );
}

function ShipmentsTab() {
  const [filters, setFilters] = useState({ carrierId: '', temperatureZone: '', dateFrom: '', dateTo: '' });

  const { data: shipments = [], isLoading } = useQuery({ queryKey: ['shipments'], queryFn: listShipments });
  const { data: carriers = [] } = useQuery({ queryKey: ['carriers'], queryFn: listCarriers });

  function carrierName(carrierId) {
    return carriers.find((c) => c.carrierId === carrierId)?.name ?? `配送会社ID:${carrierId}`;
  }

  const filteredShipments = shipments.filter((s) => {
    if (filters.carrierId && s.carrierId !== Number(filters.carrierId)) return false;
    if (filters.temperatureZone && s.temperatureZone !== filters.temperatureZone) return false;
    if (filters.dateFrom && s.shippedDate < filters.dateFrom) return false;
    if (filters.dateTo && s.shippedDate > filters.dateTo) return false;
    return true;
  });

  function handleFilterChange(event) {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  }

  function clearFilters() {
    setFilters({ carrierId: '', temperatureZone: '', dateFrom: '', dateTo: '' });
  }

  return (
    <div>
      <h2 className="h5 mb-3">出荷履歴</h2>

      <div className="row g-2 mb-3 align-items-end">
        <div className="col-6 col-md-3">
          <label className="form-label small">配送会社</label>
          <select name="carrierId" className="form-select form-select-sm" value={filters.carrierId} onChange={handleFilterChange}>
            <option value="">すべて</option>
            {carriers.map((c) => (
              <option key={c.carrierId} value={c.carrierId}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <label className="form-label small">温度帯</label>
          <select
            name="temperatureZone"
            className="form-select form-select-sm"
            value={filters.temperatureZone}
            onChange={handleFilterChange}
          >
            <option value="">すべて</option>
            <option value="AMBIENT">常温</option>
            <option value="FROZEN">冷凍</option>
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small">出荷日(開始)</label>
          <input
            type="date"
            name="dateFrom"
            className="form-control form-control-sm"
            value={filters.dateFrom}
            onChange={handleFilterChange}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small">出荷日(終了)</label>
          <input
            type="date"
            name="dateTo"
            className="form-control form-control-sm"
            value={filters.dateTo}
            onChange={handleFilterChange}
          />
        </div>
        <div className="col-6 col-md-1">
          <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={clearFilters}>
            クリア
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted">読み込み中...</p>
      ) : filteredShipments.length === 0 ? (
        <p className="text-muted">
          {shipments.length === 0 ? 'まだ出荷実績がありません。' : '条件に合う出荷実績がありません。'}
        </p>
      ) : (
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>出荷ID</th>
              <th>配送会社</th>
              <th>出荷日</th>
              <th>配送先</th>
              <th>温度帯</th>
            </tr>
          </thead>
          <tbody>
            {filteredShipments.map((s) => (
              <tr key={s.shipmentId}>
                <td>{s.shipmentId}</td>
                <td>{carrierName(s.carrierId)}</td>
                <td>{s.shippedDate}</td>
                <td>{s.destination}</td>
                <td>{s.temperatureZone === 'FROZEN' ? '冷凍' : '常温'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

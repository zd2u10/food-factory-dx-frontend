import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  createItem,
  deactivateItem,
  listItems,
  reactivateItem,
  updateItem,
} from '../../api/itemApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = {
  name: '',
  safetyStockQty: '',
  standardBatchQty: '',
  shelfLifeDays: 90,
};

export default function ItemsTab() {
  const [editingItem, setEditingItem] = useState(null);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [pendingDeactivateId, setPendingDeactivateId] = useState(null);
  const [activeFilter, setActiveFilter] = useState(''); // '' = 絞り込まない, 'true', 'false'

  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['items', { active: activeFilter }],
    queryFn: () => listItems(activeFilter),
  });

  const createMutation = useMutation({
    mutationFn: createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditingItem(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ itemId, item }) => updateItem(itemId, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      setEditingItem(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['items'] }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const displayError =
    error?.message ||
    createMutation.error?.message ||
    updateMutation.error?.message ||
    deactivateMutation.error?.message ||
    reactivateMutation.error?.message;

  function handleRequestSubmit(formValues) {
    // targetStockQty(目標在庫)は将来拡張用の項目で、現時点では入力欄を設けていない。
    // DB側はNOT NULLのため、ここでsafetyStockQty(適正在庫)と同じ値を自動的に補って送信する。
    //
    // 加水基準値(hydration*)は、この画面ではなくレシピ画面(ItemRecipePage)側で入力・更新する。
    // ここでは既存の値(editingItemに入っている値)をそのまま保持して上書きしないようにする
    // (新規登録時はundefinedのまま送られ、バックエンド側は未入力として扱う)。
    setPendingSubmit({
      ...formValues,
      targetStockQty: formValues.safetyStockQty,
      hydrationRatioMin: editingItem?.hydrationRatioMin ?? null,
      hydrationRatioMax: editingItem?.hydrationRatioMax ?? null,
      hydrationQtyMin: editingItem?.hydrationQtyMin ?? null,
      hydrationQtyMax: editingItem?.hydrationQtyMax ?? null,
    });
  }

  const deactivateTarget = items.find((i) => i.itemId === pendingDeactivateId);

  function handleConfirmSubmit() {
    if (editingItem) {
      updateMutation.mutate({ itemId: editingItem.itemId, item: pendingSubmit });
    } else {
      createMutation.mutate(pendingSubmit);
    }
    setPendingSubmit(null);
  }

  return (
    <div>
      {displayError && (
        <div className="alert alert-danger" role="alert">
          {displayError}
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <ItemForm
            key={editingItem ? editingItem.itemId : 'new'}
            initialValue={editingItem ?? emptyForm}
            isEditing={!!editingItem}
            isSaving={isSaving}
            onSubmit={handleRequestSubmit}
            onCancelEdit={() => setEditingItem(null)}
          />
        </div>

        <div className="col-12 col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 mb-0">登録済み商品一覧</h2>
            <select
              className="form-select form-select-sm w-auto"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="">状態: すべて</option>
              <option value="true">有効なもののみ</option>
              <option value="false">廃版のもののみ</option>
            </select>
          </div>
          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : (
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>商品名</th>
                  <th>適正在庫</th>
                  <th>標準バッチ数</th>
                  <th>賞味期限</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      まだ商品が登録されていません
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.itemId} className={item.active ? '' : 'text-muted'}>
                      <td>{item.itemId}</td>
                      <td>{item.name}</td>
                      <td>{item.safetyStockQty}</td>
                      <td>{item.standardBatchQty}</td>
                      <td>{item.shelfLifeDays}日</td>
                      <td>
                        {item.active ? (
                          <span className="badge text-bg-success">有効</span>
                        ) : (
                          <span className="badge text-bg-secondary">廃版</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <Link to={`/masters/items/${item.itemId}/recipe`} className="btn btn-secondary">
                            レシピ
                          </Link>
                          <button className="btn btn-primary" onClick={() => setEditingItem(item)}>
                            編集
                          </button>
                          {item.active ? (
                            <button
                              className="btn btn-danger"
                              onClick={() => setPendingDeactivateId(item.itemId)}
                            >
                              廃版にする
                            </button>
                          ) : (
                            <button
                              className="btn btn-success"
                              onClick={() => reactivateMutation.mutate(item.itemId)}
                            >
                              復元する
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmModal
        show={pendingSubmit !== null}
        title={editingItem ? 'この内容で更新します' : 'この内容で登録します'}
        confirmLabel={editingItem ? '更新する' : '登録する'}
        summaryLines={
          pendingSubmit
            ? [
                { label: '商品名', value: pendingSubmit.name },
                { label: '適正在庫', value: pendingSubmit.safetyStockQty },
                { label: '標準バッチ数', value: pendingSubmit.standardBatchQty },
                { label: '賞味期限', value: `${pendingSubmit.shelfLifeDays}日` },
              ]
            : []
        }
        onConfirm={handleConfirmSubmit}
        onCancel={() => setPendingSubmit(null)}
      />

      <ConfirmModal
        show={pendingDeactivateId !== null}
        title="この商品を廃版にします"
        confirmLabel="廃版にする"
        summaryLines={deactivateTarget ? [{ label: '商品名', value: deactivateTarget.name }] : []}
        onConfirm={() => {
          deactivateMutation.mutate(pendingDeactivateId);
          setPendingDeactivateId(null);
        }}
        onCancel={() => setPendingDeactivateId(null)}
      />
    </div>
  );
}

function ItemForm({ initialValue, isEditing, isSaving, onSubmit, onCancelEdit }) {
  const [form, setForm] = useState(initialValue);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">{isEditing ? '商品を編集' : '新規登録'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              商品名
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-control"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="safetyStockQty" className="form-label">
              適正在庫
            </label>
            <input
              id="safetyStockQty"
              name="safetyStockQty"
              type="number"
              className="form-control"
              value={form.safetyStockQty}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="standardBatchQty" className="form-label">
              標準バッチ数量
            </label>
            <input
              id="standardBatchQty"
              name="standardBatchQty"
              type="number"
              className="form-control"
              value={form.standardBatchQty}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="shelfLifeDays" className="form-label">
              賞味期限(日数)
            </label>
            <input
              id="shelfLifeDays"
              name="shelfLifeDays"
              type="number"
              className="form-control"
              value={form.shelfLifeDays}
              onChange={handleChange}
              required
            />
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-grow-1" disabled={isSaving}>
              {isSaving ? '送信中...' : isEditing ? '更新する' : '登録する'}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-outline-secondary" onClick={onCancelEdit}>
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSupplier,
  deactivateSupplier,
  listSuppliers,
  reactivateSupplier,
  updateSupplier,
} from '../../api/supplierApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = { name: '', address: '', phoneNumber: '' };

/**
 * 仕入先マスタ。material・itemsと同様、論理削除(廃版)を持たせる。
 * 倒産・取引停止等でも過去の発注・入荷記録を追跡できるよう、物理削除はしない。
 */
export default function SuppliersTab() {
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [pendingDeactivateId, setPendingDeactivateId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('');

  const queryClient = useQueryClient();

  const { data: suppliers = [], isLoading, error } = useQuery({
    queryKey: ['suppliers', { active: activeFilter }],
    queryFn: () => listSuppliers(activeFilter),
  });

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setEditingSupplier(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ supplierId, supplier }) => updateSupplier(supplierId, supplier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setEditingSupplier(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateSupplier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const reactivateMutation = useMutation({
    mutationFn: reactivateSupplier,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const displayError =
    error?.message ||
    createMutation.error?.message ||
    updateMutation.error?.message ||
    deactivateMutation.error?.message ||
    reactivateMutation.error?.message;

  function handleRequestSubmit(formValues) {
    setPendingSubmit({
      name: formValues.name,
      address: formValues.address || null,
      phoneNumber: formValues.phoneNumber || null,
    });
  }

  function handleConfirmSubmit() {
    if (editingSupplier) {
      updateMutation.mutate({ supplierId: editingSupplier.supplierId, supplier: pendingSubmit });
    } else {
      createMutation.mutate(pendingSubmit);
    }
    setPendingSubmit(null);
  }

  const deactivateTarget = suppliers.find((s) => s.supplierId === pendingDeactivateId);

  return (
    <div>
      {displayError && (
        <div className="alert alert-danger" role="alert">
          {displayError}
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <SupplierForm
            key={editingSupplier ? editingSupplier.supplierId : 'new'}
            initialValue={editingSupplier ?? emptyForm}
            isEditing={!!editingSupplier}
            isSaving={isSaving}
            onSubmit={handleRequestSubmit}
            onCancelEdit={() => setEditingSupplier(null)}
          />
        </div>

        <div className="col-12 col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 mb-0">登録済み仕入先一覧</h2>
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
                  <th>仕入先名</th>
                  <th>住所</th>
                  <th>電話番号</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">
                      まだ仕入先が登録されていません
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <tr key={supplier.supplierId} className={supplier.active ? '' : 'text-muted'}>
                      <td>{supplier.supplierId}</td>
                      <td>{supplier.name}</td>
                      <td>{supplier.address || '(未登録)'}</td>
                      <td>{supplier.phoneNumber || '(未登録)'}</td>
                      <td>
                        {supplier.active ? (
                          <span className="badge text-bg-success">有効</span>
                        ) : (
                          <span className="badge text-bg-secondary">廃版</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button className="btn btn-outline-primary" onClick={() => setEditingSupplier(supplier)}>
                            編集
                          </button>
                          {supplier.active ? (
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => setPendingDeactivateId(supplier.supplierId)}
                            >
                              廃版にする
                            </button>
                          ) : (
                            <button
                              className="btn btn-outline-success"
                              onClick={() => reactivateMutation.mutate(supplier.supplierId)}
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
        title={editingSupplier ? 'この内容で更新します' : 'この内容で登録します'}
        confirmLabel={editingSupplier ? '更新する' : '登録する'}
        summaryLines={
          pendingSubmit
            ? [
                { label: '仕入先名', value: pendingSubmit.name },
                { label: '住所', value: pendingSubmit.address ?? '(未登録)' },
                { label: '電話番号', value: pendingSubmit.phoneNumber ?? '(未登録)' },
              ]
            : []
        }
        onConfirm={handleConfirmSubmit}
        onCancel={() => setPendingSubmit(null)}
      />

      <ConfirmModal
        show={pendingDeactivateId !== null}
        title="この仕入先を廃版にします"
        confirmLabel="廃版にする"
        summaryLines={deactivateTarget ? [{ label: '仕入先名', value: deactivateTarget.name }] : []}
        onConfirm={() => {
          deactivateMutation.mutate(pendingDeactivateId);
          setPendingDeactivateId(null);
        }}
        onCancel={() => setPendingDeactivateId(null)}
      />
    </div>
  );
}

function SupplierForm({ initialValue, isEditing, isSaving, onSubmit, onCancelEdit }) {
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
        <h2 className="h5 card-title">{isEditing ? '仕入先を編集' : '新規登録'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              仕入先名
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
            <label htmlFor="address" className="form-label">
              住所(任意)
            </label>
            <input
              id="address"
              name="address"
              type="text"
              className="form-control"
              value={form.address}
              onChange={handleChange}
            />
          </div>
          <div className="mb-3">
            <label htmlFor="phoneNumber" className="form-label">
              電話番号(任意)
            </label>
            <input
              id="phoneNumber"
              name="phoneNumber"
              type="text"
              className="form-control"
              value={form.phoneNumber}
              onChange={handleChange}
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

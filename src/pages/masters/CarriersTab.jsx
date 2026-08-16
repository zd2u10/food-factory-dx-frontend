import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createCarrier, listCarriers, updateCarrier } from '../../api/carrierApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = { name: '' };

/** 配送会社マスタ。取引先と同様、論理削除は持たせず編集のみで対応する。 */
export default function CarriersTab() {
  const [editingCarrier, setEditingCarrier] = useState(null);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  const queryClient = useQueryClient();

  const { data: carriers = [], isLoading, error } = useQuery({
    queryKey: ['carriers'],
    queryFn: listCarriers,
  });

  const createMutation = useMutation({
    mutationFn: createCarrier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      setEditingCarrier(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ carrierId, carrier }) => updateCarrier(carrierId, carrier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carriers'] });
      setEditingCarrier(null);
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const displayError = error?.message || createMutation.error?.message || updateMutation.error?.message;

  function handleConfirmSubmit() {
    if (editingCarrier) {
      updateMutation.mutate({ carrierId: editingCarrier.carrierId, carrier: pendingSubmit });
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
          <CarrierForm
            key={editingCarrier ? editingCarrier.carrierId : 'new'}
            initialValue={editingCarrier ?? emptyForm}
            isEditing={!!editingCarrier}
            isSaving={isSaving}
            onSubmit={setPendingSubmit}
            onCancelEdit={() => setEditingCarrier(null)}
          />
        </div>

        <div className="col-12 col-lg-8">
          <h2 className="h5 mb-3">登録済み配送会社一覧</h2>
          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : (
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>配送会社名</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {carriers.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center text-muted">
                      まだ配送会社が登録されていません
                    </td>
                  </tr>
                ) : (
                  carriers.map((carrier) => (
                    <tr key={carrier.carrierId}>
                      <td>{carrier.carrierId}</td>
                      <td>{carrier.name}</td>
                      <td>
                        <button className="btn btn-outline-primary btn-sm" onClick={() => setEditingCarrier(carrier)}>
                          編集
                        </button>
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
        title={editingCarrier ? 'この内容で更新します' : 'この内容で登録します'}
        confirmLabel={editingCarrier ? '更新する' : '登録する'}
        summaryLines={pendingSubmit ? [{ label: '配送会社名', value: pendingSubmit.name }] : []}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setPendingSubmit(null)}
      />
    </div>
  );
}

function CarrierForm({ initialValue, isEditing, isSaving, onSubmit, onCancelEdit }) {
  const [form, setForm] = useState(initialValue);

  function handleChange(event) {
    setForm({ name: event.target.value });
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">{isEditing ? '配送会社を編集' : '新規登録'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              配送会社名
            </label>
            <input
              id="name"
              type="text"
              className="form-control"
              value={form.name}
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

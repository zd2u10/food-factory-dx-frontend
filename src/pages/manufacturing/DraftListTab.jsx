import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelBatch, confirmPlan, confirmPlanBulk, listBatches } from '../../api/manufacturingApi.js';
import { listItems } from '../../api/itemApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

export default function DraftListTab() {
  // チェックボックスで選ばれているバッチIDの集合(Setを使うと、追加/削除/存在チェックが簡潔に書ける)
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pendingBulkConfirm, setPendingBulkConfirm] = useState(false);
  const [pendingCancelBatch, setPendingCancelBatch] = useState(null); // キャンセル確認対象のバッチ

  const queryClient = useQueryClient();

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: listBatches,
  });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });

  const drafts = batches.filter((b) => b.status === 'DRAFT');

  function itemName(itemId) {
    return items.find((i) => i.itemId === itemId)?.name ?? `商品ID:${itemId}`;
  }

  const confirmMutation = useMutation({
    mutationFn: confirmPlanBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setSelectedIds(new Set());
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ batchId, cancelComment }) => cancelBatch(batchId, cancelComment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  });

  function toggleSelect(batchId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  const selectedBatches = drafts.filter((b) => selectedIds.has(b.batchId));

  if (isLoading) return <p className="text-muted">読み込み中...</p>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">Draft一覧(選択して一括確定できます)</h2>
        <button
          type="button"
          className="btn btn-primary"
          disabled={selectedIds.size === 0}
          onClick={() => setPendingBulkConfirm(true)}
        >
          選択した{selectedIds.size}件をPlanに確定する
        </button>
      </div>

      <table className="table table-striped align-middle">
        <thead>
          <tr>
            <th style={{ width: '3rem' }}></th>
            <th>商品</th>
            <th>製造日</th>
            <th>計画数量</th>
            <th>生成元</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {drafts.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center text-muted">
                対応待ちのDraftはありません
              </td>
            </tr>
          ) : (
            drafts.map((batch) => (
              <tr key={batch.batchId}>
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={selectedIds.has(batch.batchId)}
                    onChange={() => toggleSelect(batch.batchId)}
                  />
                </td>
                <td>{itemName(batch.itemId)}</td>
                <td>{batch.batchDate}</td>
                <td>{batch.plannedQty}</td>
                <td>{batch.originType === 'MRP_AUTO' ? 'MRP自動' : '手動'}</td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setPendingCancelBatch(batch)}
                  >
                    取り消す
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 一括確定の確認モーダル。選ばれた全バッチの内訳と合計をまとめて表示する。 */}
      <ConfirmModal
        show={pendingBulkConfirm}
        title="選択したDraftをPlanに確定します"
        confirmLabel="確定する"
        summaryLines={[
          ...selectedBatches.map((b) => ({
            label: itemName(b.itemId),
            value: `${b.plannedQty}件(${b.batchDate})`,
          })),
          {
            label: '合計',
            value: `${selectedBatches.reduce((sum, b) => sum + Number(b.plannedQty), 0)}件`,
          },
        ]}
        onConfirm={() => {
          confirmMutation.mutate(Array.from(selectedIds));
          setPendingBulkConfirm(false);
        }}
        onCancel={() => setPendingBulkConfirm(false)}
      />

      <CancelBatchModal
        batch={pendingCancelBatch}
        itemName={pendingCancelBatch ? itemName(pendingCancelBatch.itemId) : ''}
        onConfirm={(comment) => {
          cancelMutation.mutate({ batchId: pendingCancelBatch.batchId, cancelComment: comment });
          setPendingCancelBatch(null);
        }}
        onCancel={() => setPendingCancelBatch(null)}
      />
    </div>
  );
}

/**
 * 取り消し(cancel)専用のモーダル。理由コメントの入力欄が必要なため、
 * 共通のConfirmModalをそのまま使わず、入力欄付きの専用モーダルにしている。
 */
function CancelBatchModal({ batch, itemName, onConfirm, onCancel }) {
  const [comment, setComment] = useState('');

  if (!batch) return null;

  return (
    <>
      <div className="modal-backdrop show" style={{ zIndex: 1050 }} onClick={onCancel} />
      <div className="modal d-block show" style={{ zIndex: 1055 }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">このDraftを取り消します</h5>
              <button type="button" className="btn-close" onClick={onCancel} />
            </div>
            <div className="modal-body">
              <p>
                {itemName}({batch.plannedQty}件、{batch.batchDate})を取り消します。
                取り消すと、その場でMRPが再計算され、まだ不足していれば新しいDraftが自動生成されます。
              </p>
              <label className="form-label">取り消し理由</label>
              <input
                type="text"
                className="form-control"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                キャンセル
              </button>
              <button type="button" className="btn btn-danger" onClick={() => onConfirm(comment)}>
                取り消す
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

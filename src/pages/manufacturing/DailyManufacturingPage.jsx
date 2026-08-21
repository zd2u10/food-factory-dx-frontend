import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  cancelBatch,
  confirmPlan,
  listBatches,
  rejectBatch,
} from '../../api/manufacturingApi.js';
import { listItems } from '../../api/itemApi.js';

const STATUS_LABEL = {
  DRAFT: { text: 'Draft', className: 'text-bg-secondary' },
  PLAN: { text: '計画確定', className: 'text-bg-info' },
  MANUFACTURING: { text: '製造中', className: 'text-bg-warning' },
  COMPLETED: { text: '完了', className: 'text-bg-success' },
  REJECTED: { text: '破棄', className: 'text-bg-danger' },
  CANCELLED: { text: '取り消し', className: 'text-bg-secondary' },
};

/**
 * 特定の日付の、製造バッチ一覧・操作を行う画面(「デイリー」)。
 *
 * 準備中(DRAFT/PLAN)を主役として常時表示し、
 * 進行済み(MANUFACTURING/COMPLETED)は折りたたみセクションに入れる
 * (対応済みのものは、普段は視界から外しておきたいという設計意図)。
 *
 * キャンセル・破棄は、各バッチの状態に応じてここから直接行える:
 *   DRAFT/PLAN → キャンセル(準備段階での取り消し)
 *   MANUFACTURING → 破棄(検品前に重大な欠陥が見つかった場合)
 */
export default function DailyManufacturingPage() {
  const { date } = useParams(); // YYYY-MM-DD
  const queryClient = useQueryClient();

  const [showInProgress, setShowInProgress] = useState(false); // 「進行済み」セクションの開閉。デフォルトは閉じておく
  const [pendingCancelBatch, setPendingCancelBatch] = useState(null);
  const [cancelComment, setCancelComment] = useState('');
  const [pendingRejectBatch, setPendingRejectBatch] = useState(null);
  const [rejectComment, setRejectComment] = useState('');

  const { data: batches = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: listBatches });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });

  function itemName(itemId) {
    return items.find((i) => i.itemId === itemId)?.name ?? `商品ID:${itemId}`;
  }

  const dayBatches = batches.filter((b) => b.batchDate === date);
  const preparingBatches = dayBatches.filter((b) => b.status === 'DRAFT' || b.status === 'PLAN');
  const inProgressBatches = dayBatches.filter((b) => b.status === 'MANUFACTURING' || b.status === 'COMPLETED');
  const otherBatches = dayBatches.filter((b) => b.status === 'REJECTED' || b.status === 'CANCELLED');

  const confirmPlanMutation = useMutation({
    mutationFn: confirmPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ batchId, cancelComment }) => cancelBatch(batchId, cancelComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setPendingCancelBatch(null);
      setCancelComment('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ batchId, rejectComment }) => rejectBatch(batchId, rejectComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      setPendingRejectBatch(null);
      setRejectComment('');
    },
  });

  if (isLoading) return <p className="text-muted p-4">読み込み中...</p>;

  return (
    <div className="container-fluid py-4">
      <Link to="/manufacturing" className="d-inline-block mb-3">
        ← カレンダーへ戻る
      </Link>
      <h1 className="h4 mb-4">{date} の製造予定</h1>

      <h2 className="h5 mb-3">準備中(Draft / 計画確定済み)</h2>
      {preparingBatches.length === 0 ? (
        <p className="text-muted">この日、準備中のバッチはありません。</p>
      ) : (
        <div className="d-flex flex-column gap-2 mb-4">
          {preparingBatches.map((batch) => {
            const statusInfo = STATUS_LABEL[batch.status];
            return (
              <div className="card" key={batch.batchId}>
                <div className="card-body d-flex justify-content-between align-items-center">
                  <div>
                    <span className={`badge ${statusInfo.className} me-2`}>{statusInfo.text}</span>
                    {itemName(batch.itemId)}(計画数量: {batch.plannedQty})
                  </div>
                  <div className="btn-group btn-group-sm gap-2">
                    {batch.status === 'DRAFT' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => confirmPlanMutation.mutate(batch.batchId)}
                      >
                        PLAN確定する
                      </button>
                    )}
                    {batch.status === 'PLAN' && (
                      <Link to={`/manufacturing/batches/${batch.batchId}`} className="btn btn-primary">
                        製造を実行する
                      </Link>
                    )}
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => setPendingCancelBatch(batch)}
                    >
                      キャンセルする
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        className="btn btn-secondary mb-3"
        onClick={() => setShowInProgress((prev) => !prev)}
      >
        進行済み({inProgressBatches.length}件) {showInProgress ? '▲' : '▼'}
      </button>

      {showInProgress && (
        <div className="d-flex flex-column gap-2 mb-4">
          {inProgressBatches.length === 0 ? (
            <p className="text-muted">この日、進行済みのバッチはありません。</p>
          ) : (
            inProgressBatches.map((batch) => {
              const statusInfo = STATUS_LABEL[batch.status];
              return (
                <div className="card" key={batch.batchId}>
                  <div className="card-body d-flex justify-content-between align-items-center">
                    <div>
                      <span className={`badge ${statusInfo.className} me-2`}>{statusInfo.text}</span>
                      {itemName(batch.itemId)}(計画数量: {batch.plannedQty})
                    </div>
                    <div className="btn-group btn-group-sm gap-2">
                      {batch.status === 'MANUFACTURING' && (
                        <>
                          <Link to={`/manufacturing/batches/${batch.batchId}`} className="btn btn-primary">
                            検品完了として確定する
                          </Link>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => setPendingRejectBatch(batch)}
                          >
                            破棄する
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {otherBatches.length > 0 && (
        <>
          <h2 className="h6 text-muted mb-3">取り消し・破棄済み</h2>
          <div className="d-flex flex-column gap-2">
            {otherBatches.map((batch) => {
              const statusInfo = STATUS_LABEL[batch.status];
              return (
                <div className="card" key={batch.batchId}>
                  <div className="card-body">
                    <span className={`badge ${statusInfo.className} me-2`}>{statusInfo.text}</span>
                    {itemName(batch.itemId)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {pendingCancelBatch && (
        <CommentModal
          title={`${itemName(pendingCancelBatch.itemId)}のバッチをキャンセルします`}
          confirmLabel="キャンセルする"
          comment={cancelComment}
          onChangeComment={setCancelComment}
          onConfirm={() => cancelMutation.mutate({ batchId: pendingCancelBatch.batchId, cancelComment })}
          onCancel={() => {
            setPendingCancelBatch(null);
            setCancelComment('');
          }}
        />
      )}

      {pendingRejectBatch && (
        <CommentModal
          title={`${itemName(pendingRejectBatch.itemId)}のバッチを破棄します`}
          confirmLabel="破棄する"
          comment={rejectComment}
          onChangeComment={setRejectComment}
          onConfirm={() => rejectMutation.mutate({ batchId: pendingRejectBatch.batchId, rejectComment })}
          onCancel={() => {
            setPendingRejectBatch(null);
            setRejectComment('');
          }}
        />
      )}
    </div>
  );
}

function CommentModal({ title, confirmLabel, comment, onChangeComment, onConfirm, onCancel }) {
  return (
    <>
      <div className="modal-backdrop show" style={{ zIndex: 1050 }} onClick={onCancel} />
      <div className="modal d-block show" style={{ zIndex: 1055 }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onCancel} />
            </div>
            <div className="modal-body">
              <label className="form-label">理由・メモ</label>
              <input
                type="text"
                className="form-control"
                value={comment}
                onChange={(e) => onChangeComment(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                キャンセル
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

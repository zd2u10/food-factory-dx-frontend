import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listOpenHolds, resolveAsAcceptedLate, resolveAsReturned } from '../../api/holdApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

/**
 * 対応待ちの保留一覧・返品/結局受け入れの対応画面。
 * 交換対応は「新しい入荷明細の登録」そのものなので、この画面ではなく
 * /procurement/arrivals/new (保留への交換対応モード)で行う。
 */
export default function HoldsPage() {
  const [pendingAction, setPendingAction] = useState(null); // { hold, type: 'returned' | 'acceptedLate' }
  const [comment, setComment] = useState('');

  const queryClient = useQueryClient();

  const { data: holds = [], isLoading } = useQuery({ queryKey: ['holds'], queryFn: listOpenHolds });

  const returnedMutation = useMutation({
    mutationFn: ({ holdId, comment }) => resolveAsReturned(holdId, comment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holds'] }),
  });

  const acceptedLateMutation = useMutation({
    mutationFn: ({ holdId, comment }) => resolveAsAcceptedLate(holdId, comment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holds'] }),
  });

  function handleConfirm() {
    const { hold, type } = pendingAction;
    if (type === 'returned') {
      returnedMutation.mutate({ holdId: hold.holdId, comment });
    } else {
      acceptedLateMutation.mutate({ holdId: hold.holdId, comment });
    }
    setPendingAction(null);
    setComment('');
  }

  return (
    <div className="container-fluid py-4">
      <Link to="/procurement" className="d-inline-block mb-3">
        ← 発注・入荷へ戻る
      </Link>
      <h1 className="h4 mb-4">保留対応一覧</h1>

      <div className="alert alert-info">
        交換対応(代わりの品を受け入れる)は、こちらではなく
        <Link to="/procurement/arrivals/new"> 入荷登録画面 </Link>
        の「保留への交換対応」モードから行ってください。
      </div>

      {(returnedMutation.error || acceptedLateMutation.error) && (
        <div className="alert alert-danger">
          {returnedMutation.error?.message || acceptedLateMutation.error?.message}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted">読み込み中...</p>
      ) : holds.length === 0 ? (
        <p className="text-muted">対応待ちの保留はありません。</p>
      ) : (
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>保留ID</th>
              <th>入荷明細ID</th>
              <th>保留数量</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {holds.map((hold) => (
              <tr key={hold.holdId}>
                <td>{hold.holdId}</td>
                <td>{hold.lineId}</td>
                <td>{hold.heldQtySnapshot}</td>
                <td>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => setPendingAction({ hold, type: 'returned' })}
                    >
                      返品
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-success"
                      onClick={() => setPendingAction({ hold, type: 'acceptedLate' })}
                    >
                      結局受け入れる
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {pendingAction && (
        <CommentModal
          title={pendingAction.type === 'returned' ? '返品として対応します' : '結局受け入れるとして対応します'}
          confirmLabel={pendingAction.type === 'returned' ? '返品する' : '受け入れる'}
          comment={comment}
          onChangeComment={setComment}
          onConfirm={handleConfirm}
          onCancel={() => {
            setPendingAction(null);
            setComment('');
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
              <button type="button" className="btn btn-primary" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

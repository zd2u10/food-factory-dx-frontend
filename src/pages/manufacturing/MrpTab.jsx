import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listStaleDrafts, runMrp } from '../../api/manufacturingApi.js';
import { listItems } from '../../api/itemApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

export default function MrpTab() {
  const [pendingRun, setPendingRun] = useState(false);
  const [lastResult, setLastResult] = useState(null); // 直近のMRP実行結果(生成されたバッチ一覧)

  const queryClient = useQueryClient();

  const { data: staleDrafts = [] } = useQuery({
    queryKey: ['staleDrafts'],
    queryFn: () => listStaleDrafts(3),
  });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });

  function itemName(itemId) {
    return items.find((i) => i.itemId === itemId)?.name ?? `商品ID:${itemId}`;
  }

  const runMutation = useMutation({
    mutationFn: runMrp,
    onSuccess: (created) => {
      setLastResult(created);
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['staleDrafts'] });
    },
  });

  return (
    <div>
      <div className="card mb-4">
        <div className="card-body">
          <h2 className="h5 card-title">MRP実行</h2>
          <p className="text-muted">
            全商品について、受注残・在庫・製造予定から不足を計算し、必要なDraftを自動生成します。
          </p>
          <button type="button" className="btn btn-primary" onClick={() => setPendingRun(true)}>
            MRPを実行する
          </button>

          {lastResult && (
            <div className="alert alert-info mt-3 mb-0">
              {lastResult.length === 0
                ? '不足はありませんでした。新しいDraftは生成されていません。'
                : `${lastResult.length}件のDraftを生成しました。`}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h2 className="h5 card-title">放置されているDraft(3日以上)</h2>
          {staleDrafts.length === 0 ? (
            <p className="text-muted mb-0">放置されているDraftはありません。</p>
          ) : (
            <ul className="list-group">
              {staleDrafts.map((batch) => (
                <li className="list-group-item" key={batch.batchId}>
                  ⚠ {itemName(batch.itemId)}({batch.plannedQty}件、{batch.batchDate})が
                  確定も取り消しもされないまま残っています。
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmModal
        show={pendingRun}
        title="MRPを実行します"
        confirmLabel="実行する"
        summaryLines={[
          { label: '対象', value: '全商品' },
          { label: '内容', value: '不足分を計算し、必要なDraftを自動生成します' },
        ]}
        onConfirm={() => {
          runMutation.mutate();
          setPendingRun(false);
        }}
        onCancel={() => setPendingRun(false)}
      />
    </div>
  );
}

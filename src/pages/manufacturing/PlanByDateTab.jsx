import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listBatches } from '../../api/manufacturingApi.js';
import { listItems } from '../../api/itemApi.js';

const STATUS_LABEL = {
  PLAN: { text: '予定確定', className: 'text-bg-info' },
  MANUFACTURING: { text: '製造中', className: 'text-bg-warning' },
  COMPLETED: { text: '完了', className: 'text-bg-success' },
  REJECTED: { text: '破棄', className: 'text-bg-danger' },
};

/**
 * PLAN以降(PLAN/MANUFACTURING/COMPLETED/REJECTED)のバッチを、製造日ごとにグループ化して表示する。
 * 各バッチをクリックすると、FEFO実行・検品を行う詳細画面(BatchExecutionPage)へ遷移する。
 */
export default function PlanByDateTab() {
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches'],
    queryFn: listBatches,
  });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });

  function itemName(itemId) {
    return items.find((i) => i.itemId === itemId)?.name ?? `商品ID:${itemId}`;
  }

  if (isLoading) return <p className="text-muted">読み込み中...</p>;

  const targetBatches = batches.filter((b) =>
    ['PLAN', 'MANUFACTURING', 'COMPLETED', 'REJECTED'].includes(b.status)
  );

  // batchDateをキーにして、同じ日のバッチ同士をまとめる。
  // reduce: 配列を1つずつ処理しながら「累積結果(グループ分けされたオブジェクト)」を組み立てていく関数。
  const groupedByDate = targetBatches.reduce((groups, batch) => {
    const dateKey = batch.batchDate;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(batch);
    return groups;
  }, {});

  // 日付が新しい順に並べる
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => (a < b ? 1 : -1));

  return (
    <div>
      <h2 className="h5 mb-3">日別の製造予定</h2>

      {sortedDates.length === 0 ? (
        <p className="text-muted">確定した予定はまだありません。</p>
      ) : (
        sortedDates.map((date) => (
          <div className="card mb-3" key={date}>
            <div className="card-header fw-bold">{date}</div>
            <ul className="list-group list-group-flush">
              {groupedByDate[date].map((batch) => {
                const statusInfo = STATUS_LABEL[batch.status] ?? { text: batch.status, className: 'text-bg-secondary' };
                return (
                  <li
                    className="list-group-item d-flex justify-content-between align-items-center"
                    key={batch.batchId}
                  >
                    <div>
                      <span className="fw-bold me-2">{itemName(batch.itemId)}</span>
                      <span className="text-muted">計画 {batch.plannedQty}件</span>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${statusInfo.className}`}>{statusInfo.text}</span>
                      <Link to={`/manufacturing/batches/${batch.batchId}`} className="btn btn-primary btn-sm">
                        詳細へ
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

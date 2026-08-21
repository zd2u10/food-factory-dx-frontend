import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listBatches, runMrp } from '../../api/manufacturingApi.js';
import { listItems } from '../../api/itemApi.js';
import { itemUnitLabel } from '../../utils/unitLabel.js';

/**
 * Draft一覧(読み取り専用)。
 *
 * 【設計意図】操作(PLAN確定・キャンセルなど)は全てデイリー画面に集約しており、
 * この画面自体には操作ボタンを置かない。あくまで「今どんなDraftがあるか」を
 * 俯瞰するための画面。各行の製造日をクリックすると、対応するデイリー画面へ
 * 遷移できるようにしており、「入れっぱなしで確定し忘れているDraft」に
 * 気づくきっかけとしても機能する。
 */
export default function DraftListViewPage() {
  const queryClient = useQueryClient();
  const { data: batches = [], isLoading } = useQuery({ queryKey: ['batches'], queryFn: listBatches });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: () => listItems() });

  // 一覧を眺めていて「今の受注状況が反映された、最新の状態を見たい」と思った時、
  // その場でMRPを実行できるようにする(カレンダー・受注一覧にも同じ処理のボタンがあるが、
  // 置かれている文脈が違う: ここは「一覧の内容が古いと感じた時に更新する」という用途)。
  const mrpMutation = useMutation({
    mutationFn: runMrp,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['batches'] }),
  });

  function itemName(itemId) {
    return items.find((i) => i.itemId === itemId)?.name ?? `商品ID:${itemId}`;
  }

  const draftBatches = batches
    .filter((b) => b.status === 'DRAFT')
    .sort((a, b) => (a.batchDate < b.batchDate ? -1 : 1));

  return (
    <div className="container-fluid py-4">
      <Link to="/manufacturing" className="d-inline-block mb-3">
        ← カレンダーへ戻る
      </Link>
      <h1 className="h4 mb-3">Draft一覧</h1>

      <button
        type="button"
        className="btn btn-primary mb-3"
        onClick={() => mrpMutation.mutate()}
        disabled={mrpMutation.isPending}
      >
        {mrpMutation.isPending ? '取得中...' : '最新のDraftを取得する'}
      </button>
      {mrpMutation.isSuccess && (
        <div className="alert alert-success">
          MRPを実行しました({mrpMutation.data?.length ?? 0}件のバッチが新しく生成されました)。
        </div>
      )}

      <p className="text-muted small">
        ここは一覧を確認するだけの画面です。PLAN確定・キャンセルなどの操作は、製造日をクリックしてデイリー画面から行ってください。
      </p>

      {isLoading ? (
        <p className="text-muted">読み込み中...</p>
      ) : draftBatches.length === 0 ? (
        <p className="text-muted">現在、Draft状態のバッチはありません。</p>
      ) : (
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>製造日</th>
              <th>商品</th>
              <th>計画数量</th>
              <th>発生元</th>
            </tr>
          </thead>
          <tbody>
            {draftBatches.map((batch) => (
              <tr key={batch.batchId}>
                <td>
                  <Link to={`/manufacturing/daily/${batch.batchDate}`}>{batch.batchDate}</Link>
                </td>
                <td>{itemName(batch.itemId)}</td>
                <td>
                  {batch.plannedQty}
                  {itemUnitLabel()}
                </td>
                <td>{batch.originType === 'MRP_AUTO' ? 'MRP自動' : '手動'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

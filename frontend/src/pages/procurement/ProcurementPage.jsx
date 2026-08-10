// 発注→入荷→検品→保留対応、という一連の流れをまとめる予定のページ。
// 対応するバックエンドAPI: /api/material-orders, /api/material-arrivals,
//                          /api/material-arrivals/{id}/lines, /api/holds
export default function ProcurementPage() {
  return (
    <div className="container py-4">
      <h1 className="h3 mb-4">発注・入荷</h1>
      <p className="text-muted">この画面は準備中です。</p>
    </div>
  );
}

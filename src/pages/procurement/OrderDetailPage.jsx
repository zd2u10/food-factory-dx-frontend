import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listMaterialOrders, listOrderLines } from '../../api/materialOrderApi.js';
import { listMaterials } from '../../api/materialApi.js';
import { listHoldsByOrderId, listOpenHolds } from '../../api/holdApi.js';
import { listSuppliers } from '../../api/supplierApi.js';

const STATUS_LABEL = {
  NOT_ARRIVED: { text: '未入荷', className: 'text-bg-secondary' },
  PARTIALLY_ARRIVED: { text: '一部入荷', className: 'text-bg-warning' },
  FULLY_ARRIVED: { text: '入荷完了', className: 'text-bg-success' },
};

const RESOLUTION_LABEL = {
  RETURNED: '返品',
  EXCHANGED: '交換対応',
  ACCEPTED_LATE: '結局受け入れ',
};

/**
 * 1つの発注の入荷状況(充足内訳)を表示する画面。
 * 保留数量が残っている明細には「保留対応」ボタンを表示し、
 * 対応する保留(hold_resolution)を見つけて、入荷登録画面の交換対応モードへ引き継ぐ。
 *
 * 【トレーサビリティ対応】発注一覧・明細は最終状態(合格/入荷完了)しか見えないため、
 * 「一度保留になったが、どう対応したか」という経緯が追いにくいという指摘を受け、
 * この発注に関わった保留の履歴(対応済みも含めて全件)を表示するセクションを追加した。
 */
export default function OrderDetailPage() {
  const { orderId } = useParams();
  const numericOrderId = Number(orderId);

  const { data: orders = [] } = useQuery({ queryKey: ['materialOrders'], queryFn: listMaterialOrders });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['orderLines', numericOrderId],
    queryFn: () => listOrderLines(numericOrderId),
  });
  // 対応待ちの保留を全件取得し、明細のlineIdと突き合わせる(「保留対応」ボタンの表示判定用)。
  const { data: holds = [] } = useQuery({ queryKey: ['holds'], queryFn: listOpenHolds });
  // この発注に関わった保留の履歴を、対応済みも含めて全件取得する(トレーサビリティ表示用)。
  const { data: holdHistory = [] } = useQuery({
    queryKey: ['holdsByOrder', numericOrderId],
    queryFn: () => listHoldsByOrderId(numericOrderId),
  });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => listSuppliers() });

  const order = orders.find((o) => o.orderId === numericOrderId);
  const orderMaterial = order ? materials.find((m) => m.materialId === order.materialId) : null;
  const isRaw = orderMaterial?.category === 'RAW';

  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
  }

  function supplierName(supplierId) {
    return suppliers.find((s) => s.supplierId === supplierId)?.name ?? `仕入先ID:${supplierId}`;
  }

  function findHoldForLine(lineId) {
    return holds.find((h) => h.lineId === lineId);
  }

  function lineLabel(lineId) {
    const line = lines.find((l) => l.lineId === lineId);
    return line ? `${line.supplierLotNo}(明細ID${lineId})` : `明細ID${lineId}`;
  }

  const totalAccepted = lines.reduce((sum, l) => sum + Number(l.acceptedQty), 0);
  const statusInfo = order ? STATUS_LABEL[order.status] ?? { text: order.status, className: 'text-bg-secondary' } : null;

  return (
    <div className="container-fluid py-4">
      <Link to="/procurement" className="d-inline-block mb-3">
        ← 発注・入荷へ戻る
      </Link>
      <h1 className="h4 mb-1">発注ID{orderId}の入荷状況</h1>

      {order && (
        <dl className="row mb-4">
          <dt className="col-3 col-md-2 text-muted fw-normal">材料</dt>
          <dd className="col-9 col-md-10">{materialName(order.materialId)}</dd>

          <dt className="col-3 col-md-2 text-muted fw-normal">仕入先</dt>
          <dd className="col-9 col-md-10">{supplierName(order.supplierId)}</dd>

          <dt className="col-3 col-md-2 text-muted fw-normal">発注数量</dt>
          <dd className="col-9 col-md-10">{order.orderQty}</dd>

          <dt className="col-3 col-md-2 text-muted fw-normal">状況</dt>
          <dd className="col-9 col-md-10">
            <span className={`badge ${statusInfo.className}`}>{statusInfo.text}</span>
          </dd>

          <dt className="col-3 col-md-2 text-muted fw-normal">合格数量の合計</dt>
          <dd className="col-9 col-md-10">
            {totalAccepted} / {order.orderQty}
          </dd>
        </dl>
      )}

      <h2 className="h5 mb-3">この発注に紐づく入荷明細</h2>
      {isLoading ? (
        <p className="text-muted">読み込み中...</p>
      ) : lines.length === 0 ? (
        <p className="text-muted">まだこの発注に対する入荷はありません。</p>
      ) : (
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>ロット番号</th>
              {isRaw && <th>産地</th>}
              <th>賞味期限</th>
              <th>合格数量</th>
              <th>保留数量</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const hasHold = Number(line.heldQty) > 0;
              const hold = hasHold ? findHoldForLine(line.lineId) : null;
              return (
                <tr key={line.lineId} className={hasHold ? 'table-warning' : ''}>
                  <td>{line.supplierLotNo}</td>
                  {isRaw && <td>{line.origin}</td>}
                  <td>{line.expiryDate}</td>
                  <td>{line.acceptedQty}</td>
                  <td>
                    {line.heldQty}
                    {hasHold && <span className="badge text-bg-warning ms-2">保留</span>}
                  </td>
                  <td>
                    {hold ? (
                      <Link
                        to={`/procurement/orders/${numericOrderId}/arrivals/new?resolvesHoldId=${hold.holdId}`}
                        className="btn btn-warning btn-sm"
                      >
                        保留対応
                      </Link>
                    ) : hasHold ? (
                      <span className="text-muted small">対応済み</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div className="d-flex gap-2 mb-4">
        <Link to={`/procurement/orders/${numericOrderId}/arrivals/new`} className="btn btn-primary">
          新しい入荷を登録する
        </Link>
      </div>

      {/*
        保留の履歴セクション。監査・トレーサビリティのため、対応済み(RESOLVED)も含めて
        全件表示する。最終的にどの明細も「合格」になっていても、ここを見れば
        「一度は保留になり、どう対応したか」という経緯を追跡できる。
      */}
      <h2 className="h5 mb-3">保留の履歴(この発注に関わったもの)</h2>
      {holdHistory.length === 0 ? (
        <p className="text-muted">この発注では、保留は発生していません。</p>
      ) : (
        <table className="table table-striped align-middle">
          <thead>
            <tr>
              <th>保留ID</th>
              <th>対象の入荷明細</th>
              <th>保留数量</th>
              <th>状態</th>
              <th>対応内容</th>
              <th>コメント</th>
              <th>発生日時</th>
            </tr>
          </thead>
          <tbody>
            {holdHistory.map((hold) => (
              <tr key={hold.holdId}>
                <td>{hold.holdId}</td>
                <td>{lineLabel(hold.lineId)}</td>
                <td>{hold.heldQtySnapshot}</td>
                <td>
                  {hold.status === 'RESOLVED' ? (
                    <span className="badge text-bg-success">対応済み</span>
                  ) : (
                    <span className="badge text-bg-warning">対応待ち</span>
                  )}
                </td>
                <td>
                  {hold.resolutionType ? RESOLUTION_LABEL[hold.resolutionType] ?? hold.resolutionType : '-'}
                  {hold.resolvedLineId && `(${lineLabel(hold.resolvedLineId)})`}
                </td>
                <td>{hold.comment || '-'}</td>
                <td>{hold.createdAt?.slice(0, 16).replace('T', ' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

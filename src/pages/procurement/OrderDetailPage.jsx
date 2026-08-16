import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listMaterialOrders, listOrderLines } from '../../api/materialOrderApi.js';
import { listMaterials } from '../../api/materialApi.js';

const STATUS_LABEL = {
  NOT_ARRIVED: { text: '未入荷', className: 'text-bg-secondary' },
  PARTIALLY_ARRIVED: { text: '一部入荷', className: 'text-bg-warning' },
  FULLY_ARRIVED: { text: '入荷完了', className: 'text-bg-success' },
};

/** 1つの発注の入荷状況(充足内訳)を表示する画面。 */
export default function OrderDetailPage() {
  const { orderId } = useParams();
  const numericOrderId = Number(orderId);

  const { data: orders = [] } = useQuery({ queryKey: ['materialOrders'], queryFn: listMaterialOrders });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['orderLines', numericOrderId],
    queryFn: () => listOrderLines(numericOrderId),
  });

  const order = orders.find((o) => o.orderId === numericOrderId);

  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
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
        <p className="text-muted mb-4">
          {materialName(order.materialId)} / 仕入先: {order.supplierId} / 発注数量: {order.orderQty} /{' '}
          <span className={`badge ${statusInfo.className}`}>{statusInfo.text}</span>
          <br />
          合格数量の合計: {totalAccepted} / {order.orderQty}
        </p>
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
              <th>産地</th>
              <th>賞味期限</th>
              <th>合格数量</th>
              <th>保留数量</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.lineId}>
                <td>{line.supplierLotNo}</td>
                <td>{line.origin}</td>
                <td>{line.expiryDate}</td>
                <td>{line.acceptedQty}</td>
                <td>{line.heldQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Link to="/procurement/arrivals/new" className="btn btn-primary mt-3">
        新しい入荷を登録する
      </Link>
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listMaterials } from '../../api/materialApi.js';
import { listPackageSpecs } from '../../api/packageSpecApi.js';
import { createMaterialArrival, registerArrivalLine } from '../../api/materialArrivalApi.js';
import { listMaterialOrders, listOrderLines } from '../../api/materialOrderApi.js';
import { listOpenHolds } from '../../api/holdApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

/**
 * 1つの産地(または保留対応)につき1ブロック分の入力値。
 * 「+ロットを追加」で、同じ産地の中に複数のロット入力欄を持てるようにしている。
 */
function emptyOriginBlock(initialHoldId) {
  return {
    key: crypto.randomUUID(),
    registrationMode: initialHoldId ? 'exchange' : 'new',
    resolvesHoldId: initialHoldId ?? '',
    specId: '', // 選んだ梱包仕様(産地)。ここから重量・単位・origin値を自動的に引く
    lots: [emptyLot()],
  };
}

function emptyLot() {
  return {
    key: crypto.randomUUID(),
    supplierLotNo: '',
    expiryDate: '',
    acceptedPackageCount: '',
    heldPackageCount: '0',
    checkDamage: true,
    checkExpiry: true,
    checkContamination: true,
  };
}

/**
 * 入荷ヘッダーと、複数の産地・複数のロットにまたがる検品明細を、まとめて1回で登録する画面。
 *
 * 【設計変更の経緯】
 * 以前はヘッダー作成→明細登録を2段階に分けていたが、ヘッダーだけ作って明細を登録せずに
 * 離脱すると、空のヘッダーがデータベースに残ってしまう不具合があった。
 * そのため、ヘッダーと明細(1件以上)をまとめて1回のボタン操作で送信する形に変更した。
 *
 * 「+産地を追加」でブロックを増やし、各産地ブロックの中で「+ロットを追加」で
 * 同じ産地から複数ロットが届いたケースにも対応する。
 */
export default function NewArrivalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const initialHoldId = searchParams.get('resolvesHoldId');
  const numericOrderId = orderId ? Number(orderId) : null;

  const [headerForm, setHeaderForm] = useState({ supplierId: '', arrivalDate: '' });
  const [originBlocks, setOriginBlocks] = useState([emptyOriginBlock(initialHoldId)]);
  const [pendingSubmit, setPendingSubmit] = useState(null);
  // 発注に紐づかない緊急入荷の場合、材料を自分で選ぶ必要がある(targetOrderが無いため)。
  const [emergencyMaterialId, setEmergencyMaterialId] = useState('');

  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: orders = [] } = useQuery({ queryKey: ['materialOrders'], queryFn: listMaterialOrders });
  const { data: holds = [] } = useQuery({ queryKey: ['holds'], queryFn: listOpenHolds });
  const targetOrder = numericOrderId ? orders.find((o) => o.orderId === numericOrderId) : null;
  // 発注に紐づく場合はその材料、緊急入荷の場合は自分で選んだ材料を使う。
  const effectiveMaterialId = targetOrder ? targetOrder.materialId : (emergencyMaterialId ? Number(emergencyMaterialId) : null);

  // 進捗表示(「物品名: X / Y (箱)」)のため、この発注に既に登録済みの入荷明細も取得する。
  const { data: existingLines = [] } = useQuery({
    queryKey: ['orderLines', numericOrderId],
    queryFn: () => listOrderLines(numericOrderId),
    enabled: !!numericOrderId,
  });

  const { data: specs = [] } = useQuery({
    queryKey: ['packageSpecs', effectiveMaterialId],
    queryFn: () => listPackageSpecs(effectiveMaterialId),
    enabled: !!effectiveMaterialId,
  });

  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
  }

  const submitMutation = useMutation({
    mutationFn: async (payload) => {
      // ヘッダーをまず作成し、そのarrivalIdを使って明細を1件ずつ登録する。
      // 明細登録中に1件でも失敗した場合、それ以前に登録済みの明細はDB上に残ってしまう
      // (フロント側だけではトランザクションを保証できないため)。
      // ただし、少なくとも「ヘッダーだけ作られて明細が0件のまま放置される」という
      // 従来の不具合は、この画面を離れない限り発生しない(離脱前に全て一括送信するため)。
      const arrival = await createMaterialArrival(payload.header);
      const results = [];
      for (const line of payload.lines) {
        const created = await registerArrivalLine(arrival.arrivalId, line.body, line.resolvesHoldId);
        results.push(created);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materialOrders'] });
      queryClient.invalidateQueries({ queryKey: ['holds'] });
      queryClient.invalidateQueries({ queryKey: ['orderLines', numericOrderId] });
      navigate(numericOrderId ? `/procurement/orders/${numericOrderId}` : '/procurement');
    },
  });

  function addOriginBlock() {
    setOriginBlocks((prev) => [...prev, emptyOriginBlock()]);
  }
  function removeOriginBlock(key) {
    setOriginBlocks((prev) => prev.filter((b) => b.key !== key));
  }
  function updateOriginBlock(key, patch) {
    setOriginBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }
  function addLot(blockKey) {
    setOriginBlocks((prev) =>
      prev.map((b) => (b.key === blockKey ? { ...b, lots: [...b.lots, emptyLot()] } : b))
    );
  }
  function removeLot(blockKey, lotKey) {
    setOriginBlocks((prev) =>
      prev.map((b) => (b.key === blockKey ? { ...b, lots: b.lots.filter((l) => l.key !== lotKey) } : b))
    );
  }
  function updateLot(blockKey, lotKey, patch) {
    setOriginBlocks((prev) =>
      prev.map((b) =>
        b.key === blockKey
          ? { ...b, lots: b.lots.map((l) => (l.key === lotKey ? { ...l, ...patch } : l)) }
          : b
      )
    );
  }

  function handleRequestSubmit() {
    const lines = [];
    for (const block of originBlocks) {
      const spec = specs.find((s) => s.specId === Number(block.specId));
      if (!spec) continue;
      for (const lot of block.lots) {
        const acceptedPkg = Number(lot.acceptedPackageCount || 0);
        const heldPkg = Number(lot.heldPackageCount || 0);
        lines.push({
          resolvesHoldId: block.registrationMode === 'exchange' ? Number(block.resolvesHoldId) : null,
          summary: {
            origin: spec.origin,
            supplierLotNo: lot.supplierLotNo,
            acceptedPkg,
            heldPkg,
            packageUnitLabel: spec.packageUnitLabel,
            acceptedQty: acceptedPkg * Number(spec.packageWeight),
            heldQty: heldPkg * Number(spec.packageWeight),
            mode: block.registrationMode,
            resolvesHoldIdRaw: block.resolvesHoldId,
          },
          body: {
            materialId: effectiveMaterialId,
            orderId: block.registrationMode === 'new' ? (targetOrder ? targetOrder.orderId : null) : null,
            supplierLotNo: lot.supplierLotNo,
            origin: spec.origin,
            expiryDate: lot.expiryDate,
            packageCount: acceptedPkg + heldPkg,
            packageWeightSnapshot: Number(spec.packageWeight),
            acceptedQty: acceptedPkg * Number(spec.packageWeight),
            heldQty: heldPkg * Number(spec.packageWeight),
            checkDamage: lot.checkDamage,
            checkExpiry: lot.checkExpiry,
            checkContamination: lot.checkContamination,
          },
        });
      }
    }
    setPendingSubmit({ header: headerForm, lines });
  }

  // 進捗表示: 発注数量に対して、既に登録済み+今まさに入力中の合格数量が、
  // パッケージ数換算でどれだけになっているかを動的に表示する。
  const representativeSpec = specs[0]; // パッケージ換算の基準(通常、産地間で重量は揃っている前提)
  const existingAcceptedQty = existingLines.reduce((sum, l) => sum + Number(l.acceptedQty), 0);
  const draftAcceptedQty = originBlocks.reduce((sum, b) => {
    const spec = specs.find((s) => s.specId === Number(b.specId));
    if (!spec) return sum;
    return sum + b.lots.reduce((s2, lot) => s2 + Number(lot.acceptedPackageCount || 0) * Number(spec.packageWeight), 0);
  }, 0);
  const totalAcceptedQty = existingAcceptedQty + draftAcceptedQty;
  const targetPackageCount = targetOrder && representativeSpec
    ? Math.ceil(Number(targetOrder.orderQty) / Number(representativeSpec.packageWeight))
    : null;
  const currentPackageCount = representativeSpec ? totalAcceptedQty / Number(representativeSpec.packageWeight) : null;

  return (
    <div className="container-fluid py-4">
      <Link to={numericOrderId ? `/procurement/orders/${numericOrderId}` : '/procurement'} className="d-inline-block mb-3">
        ← {numericOrderId ? '発注の入荷状況' : '発注・入荷'}へ戻る
      </Link>
      <h1 className="h4 mb-1">
        入荷登録{targetOrder ? `(発注ID${targetOrder.orderId}: ${materialName(targetOrder.materialId)})` : ''}
      </h1>

      {/* 進捗表示: 物品名: 現在の入力進捗 / 目標(パッケージ数) */}
      {targetOrder && representativeSpec && targetPackageCount !== null && (
        <div className="alert alert-info">
          {materialName(targetOrder.materialId)}: {Math.round(currentPackageCount)} / {targetPackageCount}
          ({representativeSpec.packageUnitLabel})
        </div>
      )}

      {submitMutation.error && <div className="alert alert-danger">{submitMutation.error.message}</div>}

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <div className="card mb-3">
            <div className="card-body">
              <h2 className="h6 card-title">入荷ヘッダー</h2>
              <div className="mb-2">
                <label className="form-label small">仕入先</label>
                <input
                  type="text"
                  className="form-control"
                  value={headerForm.supplierId}
                  onChange={(e) => setHeaderForm((prev) => ({ ...prev, supplierId: e.target.value }))}
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label small">入荷日</label>
                <input
                  type="date"
                  className="form-control"
                  value={headerForm.arrivalDate}
                  onChange={(e) => setHeaderForm((prev) => ({ ...prev, arrivalDate: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {!targetOrder && (
            <div className="card mb-3">
              <div className="card-body">
                <label className="form-label small">材料(発注に紐づかない緊急入荷のため、材料を選んでください)</label>
                <select
                  className="form-select"
                  value={emergencyMaterialId}
                  onChange={(e) => setEmergencyMaterialId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {materials.map((m) => (
                    <option key={m.materialId} value={m.materialId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {originBlocks.map((block) => (
            <OriginBlockForm
              key={block.key}
              block={block}
              specs={specs}
              holds={holds}
              onChange={(patch) => updateOriginBlock(block.key, patch)}
              onRemove={originBlocks.length > 1 ? () => removeOriginBlock(block.key) : null}
              onAddLot={() => addLot(block.key)}
              onRemoveLot={(lotKey) => removeLot(block.key, lotKey)}
              onUpdateLot={(lotKey, patch) => updateLot(block.key, lotKey, patch)}
            />
          ))}

          <button type="button" className="btn btn-outline-primary w-100 mb-3" onClick={addOriginBlock}>
            + 産地を追加
          </button>

          <button
            type="button"
            className="btn btn-primary w-100"
            disabled={submitMutation.isPending || !headerForm.supplierId || !headerForm.arrivalDate || !effectiveMaterialId}
            onClick={handleRequestSubmit}
          >
            {submitMutation.isPending ? '送信中...' : 'まとめて登録する'}
          </button>
        </div>

        <div className="col-12 col-lg-7">
          <h2 className="h5 mb-3">既に登録済みの明細</h2>
          {existingLines.length === 0 ? (
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
                {existingLines.map((line) => (
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
        </div>
      </div>

      <ConfirmModal
        show={pendingSubmit !== null}
        title={`この内容で入荷ヘッダー1件・明細${pendingSubmit?.lines.length ?? 0}件を登録します`}
        confirmLabel="登録する"
        summaryLines={
          pendingSubmit
            ? [
                { label: '仕入先', value: pendingSubmit.header.supplierId },
                { label: '入荷日', value: pendingSubmit.header.arrivalDate },
                ...pendingSubmit.lines.map((line, index) => ({
                  label: `${index + 1}. ${line.summary.origin}(${line.summary.supplierLotNo})`,
                  value: `合格${line.summary.acceptedPkg}${line.summary.packageUnitLabel}・保留${line.summary.heldPkg}${line.summary.packageUnitLabel}${
                    line.summary.mode === 'exchange' ? `(保留ID${line.summary.resolvesHoldIdRaw}への交換対応)` : ''
                  }`,
                })),
              ]
            : []
        }
        onConfirm={() => {
          submitMutation.mutate(pendingSubmit);
          setPendingSubmit(null);
        }}
        onCancel={() => setPendingSubmit(null)}
      />
    </div>
  );
}

function OriginBlockForm({ block, specs, holds, onChange, onRemove, onAddLot, onRemoveLot, onUpdateLot }) {
  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <label className="form-label mb-0">産地</label>
          {onRemove && <button type="button" className="btn-close" onClick={onRemove} aria-label="この産地ブロックを削除" />}
        </div>

        <div className="mb-2">
          <div className="btn-group w-100" role="group">
            <input
              type="radio"
              className="btn-check"
              id={`mode-new-${block.key}`}
              checked={block.registrationMode === 'new'}
              onChange={() => onChange({ registrationMode: 'new' })}
            />
            <label className="btn btn-outline-primary btn-sm" htmlFor={`mode-new-${block.key}`}>
              新規入荷
            </label>
            <input
              type="radio"
              className="btn-check"
              id={`mode-exchange-${block.key}`}
              checked={block.registrationMode === 'exchange'}
              onChange={() => onChange({ registrationMode: 'exchange' })}
            />
            <label className="btn btn-outline-warning btn-sm" htmlFor={`mode-exchange-${block.key}`}>
              保留への交換対応
            </label>
          </div>
        </div>

        {block.registrationMode === 'exchange' && (
          <div className="mb-2">
            <label className="form-label small">対応する保留</label>
            <select
              className="form-select"
              value={block.resolvesHoldId}
              onChange={(e) => onChange({ resolvesHoldId: e.target.value })}
              required
            >
              <option value="" disabled>
                選択してください
              </option>
              {holds.map((h) => (
                <option key={h.holdId} value={h.holdId}>
                  保留ID{h.holdId}(保留数量{h.heldQtySnapshot})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-2">
          <select
            className="form-select"
            value={block.specId}
            onChange={(e) => onChange({ specId: e.target.value })}
            required
          >
            <option value="" disabled>
              選択してください
            </option>
            {specs.map((spec) => (
              <option key={spec.specId} value={spec.specId}>
                {spec.origin}({spec.packageWeight} / {spec.packageUnitLabel})
              </option>
            ))}
          </select>
        </div>

        {block.lots.map((lot, index) => (
          <div className="border rounded p-2 mb-2" key={lot.key}>
            <div className="d-flex justify-content-between align-items-center mb-1">
              <span className="small text-muted">ロット{index + 1}</span>
              {block.lots.length > 1 && (
                <button type="button" className="btn-close btn-sm" onClick={() => onRemoveLot(lot.key)} />
              )}
            </div>
            <div className="mb-2">
              <label className="form-label small">ロット番号</label>
              <input
                type="text"
                className="form-control"
                value={lot.supplierLotNo}
                onChange={(e) => onUpdateLot(lot.key, { supplierLotNo: e.target.value })}
                required
              />
            </div>
            <div className="mb-2">
              <label className="form-label small">賞味期限</label>
              <input
                type="date"
                className="form-control"
                value={lot.expiryDate}
                onChange={(e) => onUpdateLot(lot.key, { expiryDate: e.target.value })}
                required
              />
            </div>
            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="form-label small">合格</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={lot.acceptedPackageCount}
                  onChange={(e) => onUpdateLot(lot.key, { acceptedPackageCount: e.target.value })}
                  required
                />
              </div>
              <div className="col-6">
                <label className="form-label small">保留</label>
                <input
                  type="number"
                  min="0"
                  className="form-control"
                  value={lot.heldPackageCount}
                  onChange={(e) => onUpdateLot(lot.key, { heldPackageCount: e.target.value })}
                  required
                />
              </div>
            </div>
            <label className="form-label small d-block">検品項目(チェック=問題なし)</label>
            <div className="form-check form-check-inline">
              <input
                type="checkbox"
                className="form-check-input"
                checked={lot.checkDamage}
                onChange={(e) => onUpdateLot(lot.key, { checkDamage: e.target.checked })}
              />
              <label className="form-check-label small">破損なし</label>
            </div>
            <div className="form-check form-check-inline">
              <input
                type="checkbox"
                className="form-check-input"
                checked={lot.checkExpiry}
                onChange={(e) => onUpdateLot(lot.key, { checkExpiry: e.target.checked })}
              />
              <label className="form-check-label small">期限問題なし</label>
            </div>
            <div className="form-check form-check-inline">
              <input
                type="checkbox"
                className="form-check-input"
                checked={lot.checkContamination}
                onChange={(e) => onUpdateLot(lot.key, { checkContamination: e.target.checked })}
              />
              <label className="form-check-label small">異物混入なし</label>
            </div>
          </div>
        ))}

        <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={onAddLot}>
          + この産地にロットを追加
        </button>
      </div>
    </div>
  );
}

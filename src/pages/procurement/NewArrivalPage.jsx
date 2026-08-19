import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listMaterials } from '../../api/materialApi.js';
import { listPackageSpecs } from '../../api/packageSpecApi.js';
import { createMaterialArrival, registerArrivalLine } from '../../api/materialArrivalApi.js';
import { listMaterialOrders, listOrderLines } from '../../api/materialOrderApi.js';
import { listOpenHolds, resolveAsAcceptedLate } from '../../api/holdApi.js';
import { listSuppliers } from '../../api/supplierApi.js';
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
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => listSuppliers() });
  const { data: orders = [] } = useQuery({ queryKey: ['materialOrders'], queryFn: listMaterialOrders });
  const { data: holds = [] } = useQuery({ queryKey: ['holds'], queryFn: listOpenHolds });
  const targetOrder = numericOrderId ? orders.find((o) => o.orderId === numericOrderId) : null;
  // 発注に紐づく場合はその材料、緊急入荷の場合は自分で選んだ材料を使う。
  const effectiveMaterialId = targetOrder ? targetOrder.materialId : (emergencyMaterialId ? Number(emergencyMaterialId) : null);

  // 発注一覧から「入荷登録」で来た場合、その発注に登録済みの仕入先を、
  // 入荷ヘッダーの仕入先欄にあらかじめ入力しておく(選び直す手間を省くため)。
  // targetOrderはAPIから非同期で取得されるため、届いた時点で1回だけセットする。
  // 既に人が仕入先を手動で選んでいた場合は上書きしない。
  useEffect(() => {
    if (targetOrder && !headerForm.supplierId) {
      setHeaderForm((prev) => ({ ...prev, supplierId: String(targetOrder.supplierId) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrder]);

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

  const effectiveMaterial = materials.find((m) => m.materialId === effectiveMaterialId);
  const isRaw = effectiveMaterial?.category === 'RAW';
  // 添加物は「1材料につき梱包仕様は常に1件」という前提のため、選択の余地が無い。
  // specsが取得できた時点で、その唯一の仕様を自動的に選択済みにしておく。
  useEffect(() => {
    // isRawがまだ確定していない(materialsが未ロード)場合は何もしない。
    // materialsがロードされてisRawが確定した時点で、この関数はもう一度呼ばれる
    // (依存配列にisRawを含めているため)。
    if (isRaw === undefined || isRaw === null) return;
    if (isRaw) return; // 原料は人が選ぶため自動選択しない

    if (specs.length !== 1) return; // 梱包仕様が0件、または複数件(想定外)なら自動選択しない

    // まだspecIdが選ばれていない産地ブロックがあれば、自動的に選択する。
    // (「保留への交換対応」など、複数の産地ブロックが存在するケースも考慮し、
    //  1件目に限定せず全ブロックを対象にする)
    originBlocks.forEach((block) => {
      if (!block.specId) {
        updateOriginBlock(block.key, { specId: String(specs[0].specId) });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRaw, specs, originBlocks]);
  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
  }

  function supplierName(supplierId) {
    return suppliers.find((s) => s.supplierId === supplierId)?.name ?? `仕入先ID:${supplierId}`;
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

  // 「結局受け入れる」専用のミューテーション。既存の保留データをそのまま使うため、
  // 新しく入荷ヘッダー・明細を作らず、対象のholdIdだけを指定して呼ぶだけで完結する。
  const acceptLateMutation = useMutation({
    mutationFn: ({ holdId, comment }) => resolveAsAcceptedLate(holdId, comment),
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
      // 「結局受け入れる」ブロックは、個別の即時ボタン(onAcceptLate)で既に処理されるため、
      // ここでの一括登録の対象には含めない。
      if (block.registrationMode === 'acceptLate') continue;
      const spec = specs.find((s) => s.specId === Number(block.specId));
      if (!spec) continue;
      for (const lot of block.lots) {
        const acceptedPkg = Number(lot.acceptedPackageCount || 0);
        const heldPkg = Number(lot.heldPackageCount || 0);
        lines.push({
          resolvesHoldId: block.registrationMode === 'exchange' ? Number(block.resolvesHoldId) : null,
          summary: {
            // 添加物の場合、spec.originは内部識別用の値(spec-xxxxxxxx)であり人が見るものではないため、
            // 代わりに材料名を表示する。原料の場合は今まで通り産地名を使う。
            origin: isRaw ? spec.origin : materialName(effectiveMaterialId),
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
            // orderId(どの発注に対する入荷か)とresolvesHoldId(どの保留への対応か)は、
            // 本来は独立した別々の情報。交換対応(exchange)の場合でも、
            // targetOrderに紐づいて開いているなら、そのorderIdを送る必要がある。
            // 【修正した不具合】以前は交換対応の場合、orderIdを常にnullにしていたため、
            // 交換品として登録した明細が発注の充足率計算(accepted_qtyの合計)に
            // 一切反映されず、発注が永久に「一部入荷」から進まなくなっていた。
            orderId: targetOrder ? targetOrder.orderId : null,
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
    setPendingSubmit({
      header: { ...headerForm, supplierId: Number(headerForm.supplierId) },
      lines,
    });
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
                <select
                  className="form-select"
                  value={headerForm.supplierId}
                  onChange={(e) => setHeaderForm((prev) => ({ ...prev, supplierId: e.target.value }))}
                  required
                >
                  <option value="" disabled>
                    選択してください
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.supplierId} value={s.supplierId}>
                      {s.name}
                    </option>
                  ))}
                </select>
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
              isRaw={isRaw}
              onChange={(patch) => updateOriginBlock(block.key, patch)}
              onRemove={originBlocks.length > 1 ? () => removeOriginBlock(block.key) : null}
              onAddLot={() => addLot(block.key)}
              onRemoveLot={(lotKey) => removeLot(block.key, lotKey)}
              onUpdateLot={(lotKey, patch) => updateLot(block.key, lotKey, patch)}
              onAcceptLate={(holdId) => acceptLateMutation.mutate({ holdId, comment: '入荷登録画面から結局受け入れ' })}
              isAcceptLatePending={acceptLateMutation.isPending}
            />
          ))}

          {/*
            添加物は「1材料につき梱包仕様は常に1件」のため、産地ブロックを複数に
            分ける場面が無い(仕様が変わったらマスタを直接修正する運用のため)。
            そのため、添加物を選んでいる場合はこのボタン自体を表示しない。
          */}
          {isRaw && (
            <button type="button" className="btn btn-outline-primary w-100 mb-3" onClick={addOriginBlock}>
              + 産地を追加
            </button>
          )}

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
                  {isRaw && <th>産地</th>}
                  <th>賞味期限</th>
                  <th>合格数量</th>
                  <th>保留数量</th>
                </tr>
              </thead>
              <tbody>
                {existingLines.map((line) => (
                  <tr key={line.lineId}>
                    <td>{line.supplierLotNo}</td>
                    {isRaw && <td>{line.origin}</td>}
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
                { label: '仕入先', value: supplierName(pendingSubmit.header.supplierId) },
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

function OriginBlockForm({ block, specs, holds, isRaw, onChange, onRemove, onAddLot, onRemoveLot, onUpdateLot, onAcceptLate, isAcceptLatePending }) {
  const selectedHold = holds.find((h) => h.holdId === Number(block.resolvesHoldId));

  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-end mb-2">
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
              交換品を登録
            </label>
            <input
              type="radio"
              className="btn-check"
              id={`mode-acceptlate-${block.key}`}
              checked={block.registrationMode === 'acceptLate'}
              onChange={() => onChange({ registrationMode: 'acceptLate' })}
            />
            <label className="btn btn-outline-success btn-sm" htmlFor={`mode-acceptlate-${block.key}`}>
              結局受け入れる
            </label>
          </div>
        </div>

        {(block.registrationMode === 'exchange' || block.registrationMode === 'acceptLate') && (
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

        {block.registrationMode === 'acceptLate' ? (
          // 「結局受け入れる」の場合、保留登録時に既に入力済みのデータをそのまま使うため、
          // 新しく何かを入力する必要が無い。対象の保留を選んだら、確認ボタンだけを表示する。
          <div>
            {selectedHold && (
              <p className="text-muted small">
                保留数量{selectedHold.heldQtySnapshot}分を、そのまま合格として受け入れます。
                新しく入力する項目はありません。
              </p>
            )}
            <button
              type="button"
              className="btn btn-success w-100"
              disabled={!block.resolvesHoldId || isAcceptLatePending}
              onClick={() => onAcceptLate(Number(block.resolvesHoldId))}
            >
              {isAcceptLatePending ? '送信中...' : 'この保留を結局受け入れる'}
            </button>
          </div>
        ) : (
          <>
        {isRaw ? (
          <div className="mb-2">
            <label className="form-label small">産地</label>
            <select
              className="form-select"
              value={block.specId}
              onChange={(e) => onChange({ specId: e.target.value })}
              required
            >
              {specs.length === 0 ? (
                <option value="" disabled>
                  指定なし(この材料にはまだ産地が登録されていません)
                </option>
              ) : (
                <>
                  <option value="" disabled>
                    選択してください
                  </option>
                  {specs.map((spec) => (
                    <option key={spec.specId} value={spec.specId}>
                      {spec.origin}({spec.packageWeight} / {spec.packageUnitLabel})
                    </option>
                  ))}
                </>
              )}
            </select>
            {specs.length === 0 && (
              <div className="form-text text-warning">
                「マスタ管理」→「材料」→「産地管理」から産地を登録してください。
              </div>
            )}
          </div>
        ) : (
          // 添加物: 「1材料につき梱包仕様は常に1件」の前提のため、選ぶ操作自体が不要。
          // 親コンポーネント側で自動的に選択済みにしているため、ここでは確認用に読み取り専用表示するだけ。
          <div className="mb-2">
            <label className="form-label small">梱包仕様</label>
            {specs.length === 0 ? (
              <div className="form-text text-warning">
                「マスタ管理」→「材料」→「梱包仕様管理」から梱包仕様を登録してください。
              </div>
            ) : (
              <div className="form-control-plaintext">
                {specs[0].packageWeight} / {specs[0].packageUnitLabel}
              </div>
            )}
          </div>
        )}

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
          {isRaw ? '+ この産地にロットを追加' : '+ ロットを追加'}
        </button>
          </>
        )}
      </div>
    </div>
  );
}

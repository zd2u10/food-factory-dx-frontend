import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  completeBatch,
  executeBatch,
  listBatches,
  previewFefo,
  rejectBatch,
} from '../../api/manufacturingApi.js';
import { listItems } from '../../api/itemApi.js';
import { listMaterials } from '../../api/materialApi.js';
import { DialPadField } from '../../components/DialPad.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

/**
 * 1つのバッチについて、状態に応じた画面を出し分ける詳細ページ。
 *   PLAN          → FEFO自動選定のプレビュー + 実測値入力 + 実行ボタン
 *   MANUFACTURING → 検品完了フォーム(合格数・不良数) + 破棄ボタン
 *   それ以外       → 内容の確認のみ(読み取り専用)
 *
 * タブレットでの操作を想定し、数量の入力は全てダイヤルパッド(DialPadField)を使う。
 */
export default function BatchExecutionPage() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: batches = [] } = useQuery({ queryKey: ['batches'], queryFn: listBatches });
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: listItems });

  const batch = batches.find((b) => String(b.batchId) === batchId);
  const itemName = batch ? items.find((i) => i.itemId === batch.itemId)?.name ?? `商品ID:${batch.itemId}` : '';

  function invalidateAndGoBack() {
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    navigate('/manufacturing');
  }

  if (!batch) {
    return (
      <div className="container-fluid py-4">
        <p className="text-muted">バッチが見つかりません。</p>
        <Link to="/manufacturing">製造ページへ戻る</Link>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <Link to="/manufacturing" className="d-inline-block mb-3">
        ← 製造ページへ戻る
      </Link>
      <h1 className="h4 mb-1">{itemName}</h1>
      <p className="text-muted mb-4">
        製造日: {batch.batchDate} / 計画数量: {batch.plannedQty} / 状態: {batch.status}
      </p>

      {batch.status === 'PLAN' && <ExecuteSection batch={batch} onDone={invalidateAndGoBack} />}
      {batch.status === 'MANUFACTURING' && <CompleteSection batch={batch} onDone={invalidateAndGoBack} />}
      {!['PLAN', 'MANUFACTURING'].includes(batch.status) && (
        <p className="text-muted">この状態(status: {batch.status})では操作できません。</p>
      )}
    </div>
  );
}

/** PLAN状態のバッチ: FEFOプレビューを見ながら実測値を入力し、実行(execute)する区画。 */
function ExecuteSection({ batch, onDone }) {
  const [actualUsages, setActualUsages] = useState({}); // { materialLotId: "入力文字列" }
  const [pendingExecute, setPendingExecute] = useState(false);

  const { data: preview, isLoading } = useQuery({
    queryKey: ['fefoPreview', batch.itemId],
    queryFn: () => previewFefo(batch.itemId),
  });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });

  function isRawMaterial(materialId) {
    return materials.find((m) => m.materialId === materialId)?.category === 'RAW';
  }

  const executeMutation = useMutation({
    mutationFn: (payload) => executeBatch(batch.batchId, payload),
    onSuccess: onDone,
  });

  if (isLoading) return <p className="text-muted">FEFO計算中...</p>;

  // 産地制約・残存期限ルールと同じ方針: 不足がある場合は現場判断での続行を許可せず、実行自体をブロックする。
  if (preview.shortage) {
    return (
      <div className="alert alert-danger">
        材料が不足しているため、このバッチは実行できません。
        {preview.shortageMaterialNames?.length > 0 && (
          <> 不足材料: {preview.shortageMaterialNames.join('、')}</>
        )}
      </div>
    );
  }

  const allEntered = preview.lines.every((line) => actualUsages[line.materialLotId]);

  function buildPayload() {
    return preview.lines.map((line) => ({
      materialLotId: line.materialLotId,
      usedQty: actualUsages[line.materialLotId],
    }));
  }

  return (
    <div>
      <h2 className="h5 mb-3">材料の実測値を入力してください</h2>
      <div className="row g-3">
        {preview.lines.map((line) => (
          <div className="col-12 col-md-6 col-lg-4" key={line.materialLotId}>
            <div className="card">
              <div className="card-body">
                <p className="mb-1 fw-bold">ロット: {line.supplierLotNo}</p>
                <p className="text-muted small mb-2">
                  {isRawMaterial(line.materialId) && <>産地: {line.origin} / </>}
                  参考(理論値): {line.allocatedQty}
                </p>
                <DialPadField
                  label="実測使用量"
                  value={actualUsages[line.materialLotId] ?? ''}
                  onChange={(v) =>
                    setActualUsages((prev) => ({ ...prev, [line.materialLotId]: v }))
                  }
                  unit="g"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary btn-lg mt-4"
        disabled={!allEntered}
        onClick={() => setPendingExecute(true)}
      >
        製造を実行する
      </button>

      <ConfirmModal
        show={pendingExecute}
        title="製造を実行します"
        confirmLabel="実行する"
        summaryLines={preview.lines.map((line) => ({
          label: `ロット ${line.supplierLotNo}`,
          value: `${actualUsages[line.materialLotId]} g`,
        }))}
        onConfirm={() => {
          executeMutation.mutate(buildPayload());
          setPendingExecute(false);
        }}
        onCancel={() => setPendingExecute(false)}
      />
    </div>
  );
}

/** MANUFACTURING状態のバッチ: 検品結果の入力(完了)、または重大な異常による破棄を行う区画。 */
function CompleteSection({ batch, onDone }) {
  const [acceptedQty, setAcceptedQty] = useState('');
  const [lossQty, setLossQty] = useState('0');
  const [lossComment, setLossComment] = useState('');
  const [pendingComplete, setPendingComplete] = useState(false);
  const [pendingReject, setPendingReject] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const completeMutation = useMutation({
    mutationFn: (payload) => completeBatch(batch.batchId, payload),
    onSuccess: onDone,
  });
  const rejectMutation = useMutation({
    mutationFn: (comment) => rejectBatch(batch.batchId, comment),
    onSuccess: onDone,
  });

  return (
    <div>
      <h2 className="h5 mb-3">検品結果を入力してください</h2>
      <div className="row g-3">
        <div className="col-12 col-md-6">
          <DialPadField label="合格数" value={acceptedQty} onChange={setAcceptedQty} unit="個" />
        </div>
        <div className="col-12 col-md-6">
          <DialPadField label="軽微な不良数" value={lossQty} onChange={setLossQty} unit="個" />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label">不良の理由(任意)</label>
        <input
          type="text"
          className="form-control"
          value={lossComment}
          onChange={(e) => setLossComment(e.target.value)}
        />
      </div>

      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={!acceptedQty}
          onClick={() => setPendingComplete(true)}
        >
          検品完了として確定する
        </button>
        <button type="button" className="btn btn-outline-danger" onClick={() => setPendingReject(true)}>
          重大な異常のため破棄する
        </button>
      </div>

      <ConfirmModal
        show={pendingComplete}
        title="検品結果を確定します"
        confirmLabel="確定する"
        summaryLines={[
          { label: '合格数', value: `${acceptedQty} 個` },
          { label: '軽微な不良数', value: `${lossQty} 個` },
          { label: '理由', value: lossComment || '(なし)' },
        ]}
        onConfirm={() => {
          completeMutation.mutate({ acceptedQty, lossQty, lossComment });
          setPendingComplete(false);
        }}
        onCancel={() => setPendingComplete(false)}
      />

      {pendingReject && (
        <RejectModal
          value={rejectComment}
          onChange={setRejectComment}
          onConfirm={() => {
            rejectMutation.mutate(rejectComment);
            setPendingReject(false);
          }}
          onCancel={() => setPendingReject(false)}
        />
      )}
    </div>
  );
}

function RejectModal({ value, onChange, onConfirm, onCancel }) {
  return (
    <>
      <div className="modal-backdrop show" style={{ zIndex: 1050 }} onClick={onCancel} />
      <div className="modal d-block show" style={{ zIndex: 1055 }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">このバッチを破棄します</h5>
              <button type="button" className="btn-close" onClick={onCancel} />
            </div>
            <div className="modal-body">
              <p className="text-danger">
                重大な異常によりバッチ全体を破棄します。商品在庫には一切反映されません。
                既に消費した材料は元に戻りません。
              </p>
              <label className="form-label">破棄理由(必須)</label>
              <input
                type="text"
                className="form-control"
                value={value}
                onChange={(e) => onChange(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                キャンセル
              </button>
              <button type="button" className="btn btn-danger" disabled={!value} onClick={onConfirm}>
                破棄する
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

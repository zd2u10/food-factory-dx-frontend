import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { listMaterials } from '../../api/materialApi.js';
import { listPackageSpecs } from '../../api/packageSpecApi.js';
import { createMaterialArrival, registerArrivalLine } from '../../api/materialArrivalApi.js';
import { listMaterialOrders } from '../../api/materialOrderApi.js';
import { listOpenHolds } from '../../api/holdApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyHeaderForm = { supplierId: '', arrivalDate: '' };

function emptyLineForm() {
  return {
    materialId: '',
    // registrationMode: 'new'(新規入荷) or 'exchange'(既存の保留への交換対応)。
    // 明細登録時に、人が「新規か対応か」を明示的に選ぶ(フェーズ3で確定した方針)。
    registrationMode: 'new',
    orderId: '', // 新規入荷の場合、対応する発注があれば選ぶ(緊急入荷なら空でよい)
    resolvesHoldId: '', // 交換対応の場合、どの保留に対する交換品かを選ぶ
    supplierLotNo: '',
    origin: '',
    expiryDate: '',
    packageCount: '',
    packageWeightSnapshot: '',
    acceptedQty: '',
    heldQty: '0',
    checkDamage: true,
    checkExpiry: true,
    checkContamination: true,
  };
}

/**
 * 入荷ヘッダーを1件作成し、その配下に複数の検品明細を登録する画面。
 * 1回の配送に複数の材料・複数の発注が混在してもよい(フェーズ1で確定した設計)ため、
 * ヘッダー作成後、複数の明細をそれぞれ独立して登録できるようにしている。
 */
export default function NewArrivalPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [arrivalId, setArrivalId] = useState(null);
  const [pendingHeaderSubmit, setPendingHeaderSubmit] = useState(null);
  const [pendingLineSubmit, setPendingLineSubmit] = useState(null);
  const [registeredLines, setRegisteredLines] = useState([]);

  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: orders = [] } = useQuery({ queryKey: ['materialOrders'], queryFn: listMaterialOrders });
  const { data: holds = [] } = useQuery({ queryKey: ['holds'], queryFn: listOpenHolds });

  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
  }

  const createHeaderMutation = useMutation({
    mutationFn: createMaterialArrival,
    onSuccess: (created) => setArrivalId(created.arrivalId),
  });

  const createLineMutation = useMutation({
    mutationFn: ({ line, resolvesHoldId }) => registerArrivalLine(arrivalId, line, resolvesHoldId),
    onSuccess: (created) => {
      setRegisteredLines((prev) => [...prev, created]);
      queryClient.invalidateQueries({ queryKey: ['materialOrders'] });
      queryClient.invalidateQueries({ queryKey: ['holds'] });
    },
  });

  function handleRequestHeaderSubmit(formValues) {
    setPendingHeaderSubmit(formValues);
  }

  function handleRequestLineSubmit(formValues) {
    // arrivedQty(入荷総量)はサーバー側が箱数×目安重量から自動計算するため、ここでは送らない。
    // acceptedQty + heldQty が、その自動計算された総量と一致している必要がある
    // (一致しない場合はサーバー側でエラーになる)。
    const payload = {
      materialId: Number(formValues.materialId),
      orderId: formValues.registrationMode === 'new' && formValues.orderId ? Number(formValues.orderId) : null,
      supplierLotNo: formValues.supplierLotNo,
      origin: formValues.origin,
      expiryDate: formValues.expiryDate,
      packageCount: Number(formValues.packageCount),
      packageWeightSnapshot: Number(formValues.packageWeightSnapshot),
      acceptedQty: Number(formValues.acceptedQty),
      heldQty: Number(formValues.heldQty),
      checkDamage: formValues.checkDamage,
      checkExpiry: formValues.checkExpiry,
      checkContamination: formValues.checkContamination,
    };
    const resolvesHoldId =
      formValues.registrationMode === 'exchange' && formValues.resolvesHoldId
        ? Number(formValues.resolvesHoldId)
        : null;
    setPendingLineSubmit({ line: payload, resolvesHoldId, materialId: payload.materialId });
  }

  return (
    <div className="container-fluid py-4">
      <Link to="/procurement" className="d-inline-block mb-3">
        ← 発注・入荷へ戻る
      </Link>
      <h1 className="h4 mb-4">入荷登録</h1>

      {!arrivalId ? (
        <div className="row">
          <div className="col-12 col-lg-5">
            <ArrivalHeaderForm onSubmit={handleRequestHeaderSubmit} isSaving={createHeaderMutation.isPending} />
            {createHeaderMutation.error && (
              <div className="alert alert-danger mt-3">{createHeaderMutation.error.message}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="row g-4">
          <div className="col-12 col-lg-5">
            <div className="alert alert-info">
              入荷ヘッダー(arrivalId={arrivalId})を作成しました。続けて検品明細を登録してください。
              1回の配送に複数の材料・複数の発注が混在していても、明細ごとに分けて登録できます。
            </div>
            <ArrivalLineForm
              materials={materials}
              orders={orders}
              holds={holds}
              materialName={materialName}
              onSubmit={handleRequestLineSubmit}
              isSaving={createLineMutation.isPending}
            />
            {createLineMutation.error && (
              <div className="alert alert-danger mt-3">{createLineMutation.error.message}</div>
            )}
          </div>

          <div className="col-12 col-lg-7">
            <h2 className="h5 mb-3">この入荷ヘッダーに登録した明細</h2>
            {registeredLines.length === 0 ? (
              <p className="text-muted">まだ明細が登録されていません。</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {registeredLines.map((line) => (
                  <div className="card" key={line.lineId}>
                    <div className="card-body py-2">
                      <strong>{materialName(line.materialId)}</strong>({line.supplierLotNo}、{line.origin})
                      合格:{line.acceptedQty} / 保留:{line.heldQty}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-outline-secondary mt-3" onClick={() => navigate('/procurement')}>
              登録を終える(発注・入荷へ戻る)
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        show={pendingHeaderSubmit !== null}
        title="この内容で入荷ヘッダーを登録します"
        confirmLabel="登録する"
        summaryLines={
          pendingHeaderSubmit
            ? [
                { label: '仕入先', value: pendingHeaderSubmit.supplierId },
                { label: '入荷日', value: pendingHeaderSubmit.arrivalDate },
              ]
            : []
        }
        onConfirm={() => {
          createHeaderMutation.mutate(pendingHeaderSubmit);
          setPendingHeaderSubmit(null);
        }}
        onCancel={() => setPendingHeaderSubmit(null)}
      />

      <ConfirmModal
        show={pendingLineSubmit !== null}
        title="この内容で検品明細を登録します"
        confirmLabel="登録する"
        summaryLines={
          pendingLineSubmit
            ? [
                { label: '材料', value: materialName(pendingLineSubmit.materialId) },
                { label: 'ロット番号', value: pendingLineSubmit.line.supplierLotNo },
                { label: '産地', value: pendingLineSubmit.line.origin },
                { label: '賞味期限', value: pendingLineSubmit.line.expiryDate },
                { label: '合格数量', value: pendingLineSubmit.line.acceptedQty },
                { label: '保留数量', value: pendingLineSubmit.line.heldQty },
                {
                  label: '対応区分',
                  value: pendingLineSubmit.resolvesHoldId
                    ? `交換品(hold_id=${pendingLineSubmit.resolvesHoldId}への対応)`
                    : pendingLineSubmit.line.orderId
                      ? `新規入荷(order_id=${pendingLineSubmit.line.orderId}に対応)`
                      : '新規入荷(発注に紐づかない緊急入荷)',
                },
              ]
            : []
        }
        onConfirm={() => {
          createLineMutation.mutate(pendingLineSubmit);
          setPendingLineSubmit(null);
        }}
        onCancel={() => setPendingLineSubmit(null)}
      />
    </div>
  );
}

function ArrivalHeaderForm({ onSubmit, isSaving }) {
  const [form, setForm] = useState(emptyHeaderForm);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">入荷ヘッダー(配送1回分)</h2>
        <p className="text-muted small">
          ヘッダーには「いつ・どの仕入先から届いたか」だけを登録します。材料・発注との紐付けは、
          この次に登録する明細ごとに指定します(1回の配送に複数の材料・発注が混在してもよいため)。
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label">仕入先</label>
            <input
              name="supplierId"
              type="text"
              className="form-control"
              value={form.supplierId}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">入荷日</label>
            <input
              name="arrivalDate"
              type="date"
              className="form-control"
              value={form.arrivalDate}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={isSaving}>
            {isSaving ? '送信中...' : 'ヘッダーを登録して明細登録へ進む'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ArrivalLineForm({ materials, orders, holds, materialName, onSubmit, isSaving }) {
  const [form, setForm] = useState(emptyLineForm());

  // 選んだ材料に登録されている産地(material_package_spec)を取得する。
  // レシピ画面と同じ考え方: 産地は手入力ではなく、既に登録済みの選択肢から選ぶ
  // (1つの明細=1回の梱包分=届いた産地は1つ、という前提のため単一選択にしている)。
  const { data: originSpecs = [] } = useQuery({
    queryKey: ['packageSpecs', form.materialId],
    queryFn: () => listPackageSpecs(form.materialId),
    enabled: !!form.materialId,
  });

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form);
    setForm(emptyLineForm());
  }

  // 新規入荷の場合、選んだ材料に対応する「未入荷/一部入荷」の発注だけを候補にする。
  const candidateOrders = orders.filter(
    (o) => String(o.materialId) === String(form.materialId) && o.status !== 'FULLY_ARRIVED'
  );
  // 交換対応の場合、選んだ材料に対応する保留(ON_HOLD)だけを候補にする。
  const candidateHolds = holds; // holdはmaterialIdを直接持たないため、明細IDベースの絞り込みは行わない

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">検品明細を登録</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="form-label d-block">この明細は何ですか?</label>
            <div className="btn-group w-100" role="group">
              <input
                type="radio"
                className="btn-check"
                id="mode-new"
                checked={form.registrationMode === 'new'}
                onChange={() => handleChange('registrationMode', 'new')}
              />
              <label className="btn btn-outline-primary" htmlFor="mode-new">
                新規入荷
              </label>
              <input
                type="radio"
                className="btn-check"
                id="mode-exchange"
                checked={form.registrationMode === 'exchange'}
                onChange={() => handleChange('registrationMode', 'exchange')}
              />
              <label className="btn btn-outline-warning" htmlFor="mode-exchange">
                保留への交換対応
              </label>
            </div>
          </div>

          <div className="mb-3">
            <label className="form-label">材料</label>
            <select
              className="form-select"
              value={form.materialId}
              onChange={(e) => {
                handleChange('materialId', e.target.value);
                handleChange('origin', ''); // 材料が変わったら、以前選んでいた産地はリセットする
              }}
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

          {form.registrationMode === 'new' ? (
            <div className="mb-3">
              <label className="form-label">対応する発注(任意。無ければ緊急入荷扱い)</label>
              <select
                className="form-select"
                value={form.orderId}
                onChange={(e) => handleChange('orderId', e.target.value)}
              >
                <option value="">(発注に紐づかない緊急入荷)</option>
                {candidateOrders.map((o) => (
                  <option key={o.orderId} value={o.orderId}>
                    発注ID{o.orderId}({o.orderQty}、{o.status})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mb-3">
              <label className="form-label">対応する保留</label>
              <select
                className="form-select"
                value={form.resolvesHoldId}
                onChange={(e) => handleChange('resolvesHoldId', e.target.value)}
                required
              >
                <option value="" disabled>
                  選択してください
                </option>
                {candidateHolds.map((h) => (
                  <option key={h.holdId} value={h.holdId}>
                    保留ID{h.holdId}(保留数量{h.heldQtySnapshot})
                  </option>
                ))}
              </select>
              {candidateHolds.length === 0 && (
                <div className="form-text text-warning">対応待ちの保留はありません。</div>
              )}
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">ロット番号</label>
            <input
              type="text"
              className="form-control"
              value={form.supplierLotNo}
              onChange={(e) => handleChange('supplierLotNo', e.target.value)}
              required
            />
          </div>
          <div className="mb-3">
            <label className="form-label">産地</label>
            <select
              className="form-select"
              value={form.origin}
              onChange={(e) => handleChange('origin', e.target.value)}
              disabled={!form.materialId}
              required
            >
              <option value="" disabled>
                {form.materialId ? '選択してください' : '先に材料を選んでください'}
              </option>
              {originSpecs.map((spec) => (
                <option key={spec.specId} value={spec.origin}>
                  {spec.origin}
                </option>
              ))}
            </select>
            {form.materialId && originSpecs.length === 0 && (
              <div className="form-text text-warning">
                この材料にはまだ産地が登録されていません。「マスタ管理」→「材料」→「産地管理」から登録してください。
              </div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">賞味期限</label>
            <input
              type="date"
              className="form-control"
              value={form.expiryDate}
              onChange={(e) => handleChange('expiryDate', e.target.value)}
              required
            />
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small">箱/袋数</label>
              <input
                type="number"
                className="form-control"
                value={form.packageCount}
                onChange={(e) => handleChange('packageCount', e.target.value)}
                required
              />
            </div>
            <div className="col-6">
              <label className="form-label small">1箱あたり重量(g/ml)</label>
              <input
                type="number"
                className="form-control"
                value={form.packageWeightSnapshot}
                onChange={(e) => handleChange('packageWeightSnapshot', e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-text mb-3">
            入荷総量は自動計算されます(箱/袋数 × 1箱あたり重量)。合格数量+保留数量が、この総量と一致している必要があります。
          </div>

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small">検品合格数量</label>
              <input
                type="number"
                className="form-control"
                value={form.acceptedQty}
                onChange={(e) => handleChange('acceptedQty', e.target.value)}
                required
              />
            </div>
            <div className="col-6">
              <label className="form-label small">検品保留数量</label>
              <input
                type="number"
                className="form-control"
                value={form.heldQty}
                onChange={(e) => handleChange('heldQty', e.target.value)}
                required
              />
            </div>
          </div>

          <label className="form-label d-block">検品項目(チェックが付いている=問題なし)</label>
          <div className="form-check form-check-inline">
            <input
              type="checkbox"
              className="form-check-input"
              checked={form.checkDamage}
              onChange={(e) => handleChange('checkDamage', e.target.checked)}
            />
            <label className="form-check-label">破損なし</label>
          </div>
          <div className="form-check form-check-inline">
            <input
              type="checkbox"
              className="form-check-input"
              checked={form.checkExpiry}
              onChange={(e) => handleChange('checkExpiry', e.target.checked)}
            />
            <label className="form-check-label">期限問題なし</label>
          </div>
          <div className="form-check form-check-inline mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              checked={form.checkContamination}
              onChange={(e) => handleChange('checkContamination', e.target.checked)}
            />
            <label className="form-check-label">異物混入なし</label>
          </div>

          <button type="submit" className="btn btn-primary w-100" disabled={isSaving}>
            {isSaving ? '送信中...' : 'この明細を登録する'}
          </button>
        </form>
      </div>
    </div>
  );
}

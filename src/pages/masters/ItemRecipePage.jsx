import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listItems, updateItem } from '../../api/itemApi.js';
import { listMaterials } from '../../api/materialApi.js';
import { listPackageSpecs } from '../../api/packageSpecApi.js';
import { materialUnitLabel } from '../../utils/unitLabel.js';
import {
  createRecipeItemsBulk,
  deleteRecipeItem,
  listRecipeItems,
  updateRecipeItem,
} from '../../api/recipeApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

function emptyRow(category) {
  return {
    key: crypto.randomUUID(),
    category, // 'RAW'(原料) or 'ADDITIVE'(添加物)。産地欄の表示切り替えに使う
    materialId: '',
    origins: [], // 原料の場合のみ使う。チェックボックスで複数選択した産地の配列(例: ["愛知","三重"])
    useQty: '',
    allowedOrigins: '',
    mainMaterial: false,
    liquid: false,
  };
}

export default function ItemRecipePage() {
  const { itemId } = useParams();
  const numericItemId = Number(itemId);

  const [rows, setRows] = useState([]);
  const [pendingBulkSubmit, setPendingBulkSubmit] = useState(null);
  const [editingLine, setEditingLine] = useState(null);
  const [pendingEditSubmit, setPendingEditSubmit] = useState(null);
  const [pendingHydrationSubmit, setPendingHydrationSubmit] = useState(null);
  const [pendingDeleteLine, setPendingDeleteLine] = useState(null);

  const queryClient = useQueryClient();

  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: () => listItems() });
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: recipeItems = [], isLoading } = useQuery({
    queryKey: ['recipeItems', numericItemId],
    queryFn: () => listRecipeItems(numericItemId),
  });

  const item = items.find((i) => i.itemId === numericItemId);

  function materialName(materialId) {
    return materials.find((m) => m.materialId === materialId)?.name ?? `材料ID:${materialId}`;
  }

  function materialUnit(materialId) {
    return materialUnitLabel(materials.find((m) => m.materialId === materialId)?.baseUnit);
  }

  // 主原料の使用量(加水率↔加水量の換算基準)。
  // 「今フォームに入力中の主原料の行」があればそれを優先し、無ければ「既に登録済みの主原料」を使う。
  // これが変化するたびに、加水基準値フォーム側の表示を動的に再計算させる(useEffectで監視する)。
  const mainRowInForm = rows.find((r) => r.mainMaterial && r.useQty);
  const mainRegistered = recipeItems.find((r) => r.mainMaterial);
  const mainMaterialQty = mainRowInForm ? Number(mainRowInForm.useQty) : mainRegistered?.useQty ?? null;

  const bulkCreateMutation = useMutation({
    mutationFn: (payload) => createRecipeItemsBulk(numericItemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipeItems', numericItemId] });
      setRows([]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ recipeItemId, payload }) => updateRecipeItem(numericItemId, recipeItemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipeItems', numericItemId] });
      setEditingLine(null);
    },
  });

  const updateHydrationMutation = useMutation({
    mutationFn: (payload) => updateItem(numericItemId, { ...item, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (recipeItemId) => deleteRecipeItem(numericItemId, recipeItemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipeItems', numericItemId] }),
  });

  function addRow(category) {
    setRows((prev) => [...prev, emptyRow(category)]);
  }
  function removeRow(key) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }
  function updateRow(key, patch) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function handleRequestBulkSubmit() {
    const payload = rows.map((row) => ({
      materialId: Number(row.materialId),
      useQty: Number(row.useQty),
      allowedOrigins: row.category === 'RAW' ? row.origins.join(',') : '',
      mainMaterial: row.mainMaterial,
      liquid: row.liquid,
    }));
    setPendingBulkSubmit(payload);
  }

  function handleRequestEditSubmit(formValues) {
    setPendingEditSubmit({
      ...formValues,
      materialId: Number(formValues.materialId),
      useQty: Number(formValues.useQty),
    });
  }

  return (
    <div className="container-fluid py-4">
      <Link to="/masters" className="d-inline-block mb-3">
        ← マスタ管理へ戻る
      </Link>
      <h1 className="h4 mb-1">{item ? `${item.name} のレシピ` : 'レシピ'}</h1>

      {item && (
        <HydrationForm
          item={item}
          mainMaterialQty={mainMaterialQty}
          isSaving={updateHydrationMutation.isPending}
          onRequestSubmit={(values) => setPendingHydrationSubmit(values)}
        />
      )}
      {updateHydrationMutation.error && (
        <div className="alert alert-danger">{updateHydrationMutation.error.message}</div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <h2 className="h5 mb-3">材料を追加</h2>
          <div className="d-flex flex-column gap-3">
            {rows.map((row) => (
              <RecipeRowForm
                key={row.key}
                row={row}
                materials={materials.filter((m) => m.category === row.category)}
                onChange={(patch) => updateRow(row.key, patch)}
                onRemove={() => removeRow(row.key)}
              />
            ))}
          </div>

          <div className="d-flex gap-2 mt-3 flex-wrap">
            <button type="button" className="btn btn-primary" onClick={() => addRow('RAW')}>
              + 原料を追加
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => addRow('ADDITIVE')}>
              + 添加物を追加
            </button>
          </div>

          {rows.length > 0 && (
            <button
              type="button"
              className="btn btn-primary w-100 mt-3"
              disabled={bulkCreateMutation.isPending}
              onClick={handleRequestBulkSubmit}
            >
              {bulkCreateMutation.isPending ? '送信中...' : `まとめて登録する(${rows.length}件)`}
            </button>
          )}
          {bulkCreateMutation.error && (
            <div className="alert alert-danger mt-3">{bulkCreateMutation.error.message}</div>
          )}
        </div>

        <div className="col-12 col-lg-6">
          <h2 className="h5 mb-3">登録済みの材料</h2>
          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : recipeItems.length === 0 ? (
            <p className="text-muted">まだレシピが登録されていません。</p>
          ) : (
            <div className="d-flex flex-column gap-3">
              {recipeItems.map((line) => (
                <div className="card" key={line.recipeItemId}>
                  <div className="card-body">
                    <div className="d-flex justify-content-between align-items-start">
                      <h3 className="h6 card-title">{materialName(line.materialId)}</h3>
                      <div className="btn-group btn-group-sm gap-2">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setEditingLine(line)}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => setPendingDeleteLine(line)}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                    <dl className="row small mb-0">
                      <dt className="col-6">使用量</dt>
                      <dd className="col-6">{line.useQty}{materialUnit(line.materialId)}</dd>
                      <dt className="col-6">許可産地</dt>
                      <dd className="col-6">{line.allowedOrigins || '(添加物のため対象外)'}</dd>
                      <dt className="col-6">主原料</dt>
                      <dd className="col-6">{line.mainMaterial ? 'はい' : 'いいえ'}</dd>
                      <dt className="col-6">液体</dt>
                      <dd className="col-6">{line.liquid ? 'はい' : 'いいえ'}</dd>
                    </dl>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        show={pendingHydrationSubmit !== null}
        title="加水基準値をこの内容で更新します"
        confirmLabel="更新する"
        summaryLines={
          pendingHydrationSubmit
            ? [
                {
                  label: '加水率',
                  value: `${pendingHydrationSubmit.hydrationRatioMin ?? '?'}% 〜 ${pendingHydrationSubmit.hydrationRatioMax ?? '?'}%`,
                },
                {
                  label: '加水量',
                  value: `${pendingHydrationSubmit.hydrationQtyMin ?? '?'}ml 〜 ${pendingHydrationSubmit.hydrationQtyMax ?? '?'}ml`,
                },
              ]
            : []
        }
        onConfirm={() => {
          updateHydrationMutation.mutate(pendingHydrationSubmit);
          setPendingHydrationSubmit(null);
        }}
        onCancel={() => setPendingHydrationSubmit(null)}
      />

      <ConfirmModal
        show={pendingBulkSubmit !== null}
        title={`この内容で${pendingBulkSubmit?.length ?? 0}件のレシピを登録します`}
        confirmLabel="登録する"
        summaryLines={
          pendingBulkSubmit
            ? pendingBulkSubmit.map((line, index) => ({
                label: `${index + 1}. ${materialName(line.materialId)}`,
                value: `${line.useQty}${materialUnit(line.materialId)}`,
              }))
            : []
        }
        onConfirm={() => {
          bulkCreateMutation.mutate(pendingBulkSubmit);
          setPendingBulkSubmit(null);
        }}
        onCancel={() => setPendingBulkSubmit(null)}
      />

      {editingLine && (
        <EditRecipeModal
          line={editingLine}
          materials={materials}
          onRequestSubmit={handleRequestEditSubmit}
          onCancel={() => setEditingLine(null)}
        />
      )}

      <ConfirmModal
        show={pendingEditSubmit !== null}
        title="この内容で更新します"
        confirmLabel="更新する"
        summaryLines={
          pendingEditSubmit
            ? [
                { label: '材料', value: materialName(pendingEditSubmit.materialId) },
                { label: '使用量', value: `${pendingEditSubmit.useQty}${materialUnit(pendingEditSubmit.materialId)}` },
                { label: '許可産地', value: pendingEditSubmit.allowedOrigins },
                { label: '主原料', value: pendingEditSubmit.mainMaterial ? 'はい' : 'いいえ' },
                { label: '液体', value: pendingEditSubmit.liquid ? 'はい' : 'いいえ' },
              ]
            : []
        }
        onConfirm={() => {
          updateMutation.mutate({ recipeItemId: editingLine.recipeItemId, payload: pendingEditSubmit });
          setPendingEditSubmit(null);
        }}
        onCancel={() => setPendingEditSubmit(null)}
      />

      <ConfirmModal
        show={pendingDeleteLine !== null}
        title="このレシピ明細を削除します"
        confirmLabel="削除する"
        summaryLines={
          pendingDeleteLine
            ? [
                { label: '材料', value: materialName(pendingDeleteLine.materialId) },
                { label: '使用量', value: `${pendingDeleteLine.useQty}${materialUnit(pendingDeleteLine.materialId)}` },
              ]
            : []
        }
        onConfirm={() => {
          deleteMutation.mutate(pendingDeleteLine.recipeItemId);
          setPendingDeleteLine(null);
        }}
        onCancel={() => setPendingDeleteLine(null)}
      />
    </div>
  );
}

/**
 * 商品の加水基準値(items側のデータ)を編集するフォーム。
 *
 * 【自動計算の仕組み】
 * mainMaterialQty(主原料の使用量)を基準に、率(%)と量(ml)を相互変換する。
 * どちらを「基準にして計算するか」は、min/maxそれぞれ「最後に人が編集した方」で決める
 * (lastEditedRef.current に 'ratio' か 'qty' を記録しておく)。
 *
 * mainMaterialQtyそのものが変化した場合(主原料の使用量を後から変えた場合)は、
 * useEffectでそれを検知し、「最後に編集した方」を基準に、もう片方を再計算する。
 * これにより、率を先に入力していても、後から主原料の量を変えれば
 * 加水量が自動的に追従する(要件通りの動的な挙動)。
 */
function HydrationForm({ item, mainMaterialQty, isSaving, onRequestSubmit }) {
  const [minRatio, setMinRatio] = useState(item.hydrationRatioMin ?? '');
  const [maxRatio, setMaxRatio] = useState(item.hydrationRatioMax ?? '');
  const [minQty, setMinQty] = useState(item.hydrationQtyMin ?? '');
  const [maxQty, setMaxQty] = useState(item.hydrationQtyMax ?? '');

  // 「最後にどちらを編集したか」を、再描画をまたいで覚えておくための入れ物。
  // useRef: 値が変わっても再描画を引き起こさない、かつ再描画をまたいで値を保持し続ける仕組み。
  // 「次にmainMaterialQtyが変化した時、率と量のどちらを基準にするか」を記録するためだけに使う。
  const lastEditedMinRef = useRef('ratio');
  const lastEditedMaxRef = useRef('ratio');

  function ratioToQty(ratio) {
    if (!mainMaterialQty || ratio === '') return '';
    return ((Number(ratio) / 100) * mainMaterialQty).toFixed(1);
  }
  function qtyToRatio(qty) {
    if (!mainMaterialQty || qty === '') return '';
    return ((Number(qty) / mainMaterialQty) * 100).toFixed(1);
  }

  // mainMaterialQtyが変化するたびに、「最後に編集した方」を基準にもう片方を再計算する。
  useEffect(() => {
    if (lastEditedMinRef.current === 'ratio' && minRatio !== '') {
      setMinQty(ratioToQty(minRatio));
    } else if (lastEditedMinRef.current === 'qty' && minQty !== '') {
      setMinRatio(qtyToRatio(minQty));
    }
    if (lastEditedMaxRef.current === 'ratio' && maxRatio !== '') {
      setMaxQty(ratioToQty(maxRatio));
    } else if (lastEditedMaxRef.current === 'qty' && maxQty !== '') {
      setMaxRatio(qtyToRatio(maxQty));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainMaterialQty]);

  function handleMinRatioChange(value) {
    lastEditedMinRef.current = 'ratio';
    setMinRatio(value);
    setMinQty(ratioToQty(value));
  }
  function handleMinQtyChange(value) {
    lastEditedMinRef.current = 'qty';
    setMinQty(value);
    setMinRatio(qtyToRatio(value));
  }
  function handleMaxRatioChange(value) {
    lastEditedMaxRef.current = 'ratio';
    setMaxRatio(value);
    setMaxQty(ratioToQty(value));
  }
  function handleMaxQtyChange(value) {
    lastEditedMaxRef.current = 'qty';
    setMaxQty(value);
    setMaxRatio(qtyToRatio(value));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const toNullableNumber = (v) => (v === '' ? null : Number(v));
    onRequestSubmit({
      hydrationRatioMin: toNullableNumber(minRatio),
      hydrationRatioMax: toNullableNumber(maxRatio),
      hydrationQtyMin: toNullableNumber(minQty),
      hydrationQtyMax: toNullableNumber(maxQty),
    });
  }

  return (
    <div className="card mb-4">
      <div className="card-body">
        <h2 className="h6 card-title">加水基準値</h2>
        <p className="text-muted small">
          {mainMaterialQty
            ? `主原料の使用量(${mainMaterialQty})を基準に、率⇔量を自動計算します。`
            : '主原料がまだ登録されていないため、率と量は連動せず個別の値として保存されます。'}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="row g-2 mb-2 align-items-end">
            <div className="col-6">
              <label className="form-label small">加水率 下限(%)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={minRatio}
                onChange={(e) => handleMinRatioChange(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="form-label small">加水量 下限(ml)</label>
              <input
                type="number"
                className="form-control"
                value={minQty}
                onChange={(e) => handleMinQtyChange(e.target.value)}
              />
            </div>
          </div>
          <div className="row g-2 mb-3 align-items-end">
            <div className="col-6">
              <label className="form-label small">加水率 上限(%)</label>
              <input
                type="number"
                step="0.1"
                className="form-control"
                value={maxRatio}
                onChange={(e) => handleMaxRatioChange(e.target.value)}
              />
            </div>
            <div className="col-6">
              <label className="form-label small">加水量 上限(ml)</label>
              <input
                type="number"
                className="form-control"
                value={maxQty}
                onChange={(e) => handleMaxQtyChange(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
            {isSaving ? '送信中...' : '加水基準値を更新'}
          </button>
        </form>
      </div>
    </div>
  );
}

/** 動的フォームの1行分。原料の場合、産地はmaterial_package_specから取得したものをセレクトで選ぶ。 */
function RecipeRowForm({ row, materials, onChange, onRemove }) {
  const { data: originSpecs = [] } = useQuery({
    queryKey: ['packageSpecs', row.materialId],
    queryFn: () => listPackageSpecs(row.materialId),
    enabled: row.category === 'RAW' && !!row.materialId, // 原料が選ばれるまでは問い合わせない
  });

  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <span className="badge text-bg-light">{row.category === 'RAW' ? '原料' : '添加物'}</span>
          <button type="button" className="btn-close" onClick={onRemove} aria-label="この行を削除" />
        </div>

        <label className="form-label">材料</label>
        <select
          className="form-select mb-2"
          value={row.materialId}
          onChange={(e) => onChange({ materialId: e.target.value, origins: [] })}
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

        {row.category === 'RAW' && (
          <div className="mb-2">
            <label className="form-label small d-block">
              産地(複数選択可。選んだ産地のどれを使ってもよい、という意味になります)
            </label>
            {!row.materialId ? (
              <div className="form-text">先に材料を選んでください</div>
            ) : originSpecs.length === 0 ? (
              <div className="form-text text-warning">
                この材料にはまだ産地が登録されていません。「マスタ管理」→「材料」→「産地管理」から登録してください。
              </div>
            ) : (
              <div className="d-flex flex-wrap gap-3">
                {originSpecs.map((spec) => (
                  <div className="form-check" key={spec.specId}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`origin-${row.key}-${spec.specId}`}
                      checked={row.origins.includes(spec.origin)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...row.origins, spec.origin]
                          : row.origins.filter((o) => o !== spec.origin);
                        onChange({ origins: next });
                      }}
                    />
                    <label className="form-check-label" htmlFor={`origin-${row.key}-${spec.specId}`}>
                      {spec.origin}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mb-2">
          <label className="form-label small">使用量(g/ml)</label>
          <input
            type="number"
            className="form-control"
            value={row.useQty}
            onChange={(e) => onChange({ useQty: e.target.value })}
          />
        </div>

        <div className="form-check form-check-inline">
          <input
            type="checkbox"
            className="form-check-input"
            checked={row.mainMaterial}
            onChange={(e) => onChange({ mainMaterial: e.target.checked })}
          />
          <label className="form-check-label">主原料</label>
        </div>
        <div className="form-check form-check-inline">
          <input
            type="checkbox"
            className="form-check-input"
            checked={row.liquid}
            onChange={(e) => onChange({ liquid: e.target.checked })}
          />
          <label className="form-check-label">液体</label>
        </div>
      </div>
    </div>
  );
}

function EditRecipeModal({ line, materials, onRequestSubmit, onCancel }) {
  const [form, setForm] = useState({
    materialId: line.materialId,
    useQty: line.useQty,
    // allowedOriginsはDB上カンマ区切りの文字列だが、編集フォーム内では配列として扱う。
    // 空文字(添加物など)の場合は空配列にしておく。
    origins: line.allowedOrigins ? line.allowedOrigins.split(',').filter((o) => o) : [],
    mainMaterial: line.mainMaterial,
    liquid: line.liquid,
  });

  const selectedMaterial = materials.find((m) => m.materialId === Number(form.materialId));
  const isRaw = selectedMaterial?.category === 'RAW';

  const { data: originSpecs = [] } = useQuery({
    queryKey: ['packageSpecs', form.materialId],
    queryFn: () => listPackageSpecs(form.materialId),
    enabled: isRaw && !!form.materialId,
  });

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmitClick() {
    onRequestSubmit({
      materialId: form.materialId,
      useQty: form.useQty,
      allowedOrigins: isRaw ? form.origins.join(',') : '',
      mainMaterial: form.mainMaterial,
      liquid: form.liquid,
    });
  }

  return (
    <>
      <div className="modal-backdrop show" style={{ zIndex: 1050 }} onClick={onCancel} />
      <div className="modal d-block show" style={{ zIndex: 1055 }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">レシピ明細を編集</h5>
              <button type="button" className="btn-close" onClick={onCancel} />
            </div>
            <div className="modal-body">
              <div className="mb-2">
                <label className="form-label">材料</label>
                <select
                  className="form-select"
                  value={form.materialId}
                  onChange={(e) => handleChange('materialId', e.target.value)}
                >
                  {materials.map((m) => (
                    <option key={m.materialId} value={m.materialId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label">使用量(g/ml)</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.useQty}
                  onChange={(e) => handleChange('useQty', e.target.value)}
                />
              </div>
              {isRaw && (
                <div className="mb-2">
                  <label className="form-label d-block">産地(複数選択可)</label>
                  {originSpecs.length === 0 ? (
                    <div className="form-text text-warning">この材料にはまだ産地が登録されていません。</div>
                  ) : (
                    <div className="d-flex flex-wrap gap-3">
                      {originSpecs.map((spec) => (
                        <div className="form-check" key={spec.specId}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`edit-origin-${spec.specId}`}
                            checked={form.origins.includes(spec.origin)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.origins, spec.origin]
                                : form.origins.filter((o) => o !== spec.origin);
                              handleChange('origins', next);
                            }}
                          />
                          <label className="form-check-label" htmlFor={`edit-origin-${spec.specId}`}>
                            {spec.origin}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="form-check form-check-inline">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={form.mainMaterial}
                  onChange={(e) => handleChange('mainMaterial', e.target.checked)}
                />
                <label className="form-check-label">主原料</label>
              </div>
              <div className="form-check form-check-inline">
                <input
                  type="checkbox"
                  className="form-check-input"
                  checked={form.liquid}
                  onChange={(e) => handleChange('liquid', e.target.checked)}
                />
                <label className="form-check-label">液体</label>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                キャンセル
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmitClick}>
                次へ(確認)
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

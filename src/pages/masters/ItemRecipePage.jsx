import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listItems } from '../../api/itemApi.js';
import { listMaterials } from '../../api/materialApi.js';
import { createRecipeItemsBulk, listRecipeItems, updateRecipeItem } from '../../api/recipeApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

// 動的フォームの1行分の初期値。「+」ボタンを押すたびに、この形の行を配列に追加していく。
function emptyRow() {
  return {
    // key: React上で行を一意に識別するための値(DBのIDとは無関係。行の追加・削除のためだけに使う)。
    key: crypto.randomUUID(),
    materialId: '',
    useQty: '',
    allowedOrigins: '',
    mainMaterial: false,
    liquid: false,
  };
}

/**
 * 1つの商品に対応するレシピを表示・登録・編集する画面。
 * 新規登録は「+」ボタンで入力行を動的に増やし、まとめて一括登録する
 * (主原料や液体材料など、レシピ全体が揃った状態で初めて登録されるようにするため)。
 */
export default function ItemRecipePage() {
  const { itemId } = useParams();
  const numericItemId = Number(itemId);

  const [rows, setRows] = useState([emptyRow()]);
  const [pendingBulkSubmit, setPendingBulkSubmit] = useState(null);
  const [editingLine, setEditingLine] = useState(null); // 編集中のレシピ明細(nullなら編集していない)
  const [pendingEditSubmit, setPendingEditSubmit] = useState(null);

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

  const bulkCreateMutation = useMutation({
    mutationFn: (payload) => createRecipeItemsBulk(numericItemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipeItems', numericItemId] });
      setRows([emptyRow()]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ recipeItemId, payload }) => updateRecipeItem(numericItemId, recipeItemId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipeItems', numericItemId] });
      setEditingLine(null);
    },
  });

  // --- 動的フォーム(新規登録)の操作 ---

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }

  function removeRow(key) {
    setRows((prev) => prev.filter((row) => row.key !== key));
  }

  function updateRow(key, field, value) {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function handleRequestBulkSubmit() {
    // materialId/useQtyは数値に変換してから送る。keyはUIだけの都合の値なのでAPIには含めない。
    const payload = rows.map(({ key, materialId, useQty, allowedOrigins, mainMaterial, liquid }) => ({
      materialId: Number(materialId),
      useQty: Number(useQty),
      allowedOrigins,
      mainMaterial,
      liquid,
    }));
    setPendingBulkSubmit(payload);
  }

  // --- 既存明細の編集 ---

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
      <h1 className="h4 mb-4">{item ? `${item.name} のレシピ` : 'レシピ'}</h1>

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <h2 className="h5 mb-3">材料を追加</h2>
          <div className="d-flex flex-column gap-3">
            {rows.map((row) => (
              <RecipeRowForm
                key={row.key}
                row={row}
                materials={materials}
                onChange={(field, value) => updateRow(row.key, field, value)}
                onRemove={rows.length > 1 ? () => removeRow(row.key) : null}
              />
            ))}
          </div>

          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn btn-outline-primary" onClick={addRow}>
              + 材料を追加
            </button>
            <button
              type="button"
              className="btn btn-primary flex-grow-1"
              disabled={bulkCreateMutation.isPending}
              onClick={handleRequestBulkSubmit}
            >
              {bulkCreateMutation.isPending ? '送信中...' : 'まとめて登録する'}
            </button>
          </div>
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
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => setEditingLine(line)}
                      >
                        編集
                      </button>
                    </div>
                    <dl className="row small mb-0">
                      <dt className="col-6">使用量</dt>
                      <dd className="col-6">{line.useQty}</dd>
                      <dt className="col-6">許可産地</dt>
                      <dd className="col-6">{line.allowedOrigins}</dd>
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

      {/* 一括登録の確認モーダル。全行分の内訳を表示する。 */}
      <ConfirmModal
        show={pendingBulkSubmit !== null}
        title={`この内容で${pendingBulkSubmit?.length ?? 0}件のレシピを登録します`}
        confirmLabel="登録する"
        summaryLines={
          pendingBulkSubmit
            ? pendingBulkSubmit.map((line, index) => ({
                label: `${index + 1}. ${materialName(line.materialId)}`,
                value: `${line.useQty} / 産地:${line.allowedOrigins}`,
              }))
            : []
        }
        onConfirm={() => {
          bulkCreateMutation.mutate(pendingBulkSubmit);
          setPendingBulkSubmit(null);
        }}
        onCancel={() => setPendingBulkSubmit(null)}
      />

      {/* 編集用フォーム(モーダルの中にフォームを直接表示する形) */}
      {editingLine && (
        <EditRecipeModal
          line={editingLine}
          materials={materials}
          onRequestSubmit={handleRequestEditSubmit}
          onCancel={() => setEditingLine(null)}
        />
      )}

      {/* 編集内容の確認モーダル */}
      <ConfirmModal
        show={pendingEditSubmit !== null}
        title="この内容で更新します"
        confirmLabel="更新する"
        summaryLines={
          pendingEditSubmit
            ? [
                { label: '材料', value: materialName(pendingEditSubmit.materialId) },
                { label: '使用量', value: pendingEditSubmit.useQty },
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
    </div>
  );
}

/** 動的フォームの1行分。材料選択・使用量・産地・チェックボックス+削除ボタン。 */
function RecipeRowForm({ row, materials, onChange, onRemove }) {
  return (
    <div className="card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <label className="form-label mb-0">材料</label>
          {onRemove && (
            <button type="button" className="btn-close" onClick={onRemove} aria-label="この行を削除" />
          )}
        </div>
        <select
          className="form-select mb-2"
          value={row.materialId}
          onChange={(e) => onChange('materialId', e.target.value)}
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

        <div className="row g-2 mb-2">
          <div className="col-6">
            <label className="form-label small">使用量(g/ml)</label>
            <input
              type="number"
              className="form-control"
              value={row.useQty}
              onChange={(e) => onChange('useQty', e.target.value)}
            />
          </div>
          <div className="col-6">
            <label className="form-label small">許可産地(カンマ区切り)</label>
            <input
              type="text"
              className="form-control"
              placeholder="愛知,三重"
              value={row.allowedOrigins}
              onChange={(e) => onChange('allowedOrigins', e.target.value)}
            />
          </div>
        </div>

        <div className="form-check form-check-inline">
          <input
            type="checkbox"
            className="form-check-input"
            checked={row.mainMaterial}
            onChange={(e) => onChange('mainMaterial', e.target.checked)}
          />
          <label className="form-check-label">主原料</label>
        </div>
        <div className="form-check form-check-inline">
          <input
            type="checkbox"
            className="form-check-input"
            checked={row.liquid}
            onChange={(e) => onChange('liquid', e.target.checked)}
          />
          <label className="form-check-label">液体</label>
        </div>
      </div>
    </div>
  );
}

/** 既存のレシピ明細を編集するためのモーダル(共通ConfirmModalとは別の、入力欄付きの専用モーダル)。 */
function EditRecipeModal({ line, materials, onRequestSubmit, onCancel }) {
  const [form, setForm] = useState({
    materialId: line.materialId,
    useQty: line.useQty,
    allowedOrigins: line.allowedOrigins,
    mainMaterial: line.mainMaterial,
    liquid: line.liquid,
  });

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
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
              <div className="mb-2">
                <label className="form-label">許可産地(カンマ区切り)</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.allowedOrigins}
                  onChange={(e) => handleChange('allowedOrigins', e.target.value)}
                />
              </div>
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
              <button type="button" className="btn btn-primary" onClick={() => onRequestSubmit(form)}>
                次へ(確認)
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

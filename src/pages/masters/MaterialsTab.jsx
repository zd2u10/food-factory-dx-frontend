import { useAtom } from 'jotai';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  createMaterial,
  deactivateMaterial,
  listMaterials,
  reactivateMaterial,
  updateMaterial,
} from '../../api/materialApi.js';
import { activeFilterAtom, categoryFilterAtom, editingMaterialAtom } from '../../atoms/materialAtoms.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = {
  name: '',
  category: 'RAW',
  baseUnit: 'WEIGHT',
  mainMaterial: false,
};

// フォームの値(RAW/WEIGHT等の内部コード)を、確認モーダルに表示する日本語ラベルに変換する。
function categoryLabel(category) {
  return category === 'RAW' ? '原料' : '添加物';
}
function baseUnitLabel(baseUnit) {
  return baseUnit === 'WEIGHT' ? '重量(g)' : '体積(ml)';
}

export default function MaterialsTab() {
  const [categoryFilter, setCategoryFilter] = useAtom(categoryFilterAtom);
  const [activeFilter, setActiveFilter] = useAtom(activeFilterAtom);
  const [editingMaterial, setEditingMaterial] = useAtom(editingMaterialAtom);

  // pendingSubmit: 「登録/編集フォームの送信」で確認待ちになっている入力値。
  //   nullなら確認モーダルは閉じている状態。
  // pendingDeactivateId: 「廃版にする」ボタンで確認待ちになっている材料ID。
  //   これも2つの操作を同時に確認待ちにしないよう、別々のstateに分けている。
  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [pendingDeactivateId, setPendingDeactivateId] = useState(null);
  // フォームの開閉状態。「+ 新規登録」ボタンを押すか、一覧の「編集」ボタンを押した時だけ開く。
  // 登録するつもりがない時に、常時フォームが画面領域を占有しないようにするため。
  const [showForm, setShowForm] = useState(false);

  const queryClient = useQueryClient();

  const {
    data: materials = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['materials', { category: categoryFilter, active: activeFilter }],
    queryFn: () => listMaterials({ category: categoryFilter, active: activeFilter }),
  });

  const createMutation = useMutation({
    mutationFn: createMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setEditingMaterial(null);
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ materialId, material }) => updateMaterial(materialId, material),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      setEditingMaterial(null);
      setShowForm(false);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateMaterial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  });

  // 復元だけは「取り消しの手間がほぼ無い」操作のため、確認モーダルなしで即実行する
  // (共通ルール: 復元以外の操作は全て確認モーダルを挟む)。
  const reactivateMutation = useMutation({
    mutationFn: reactivateMaterial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['materials'] }),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const displayError =
    error?.message ||
    createMutation.error?.message ||
    updateMutation.error?.message ||
    deactivateMutation.error?.message ||
    reactivateMutation.error?.message;

  // フォームの「登録する/更新する」ボタンが押された瞬間に呼ばれる。
  // ここではまだAPIを呼ばず、pendingSubmitに値を保持して確認モーダルを開くだけにする。
  function handleRequestSubmit(formValues) {
    setPendingSubmit(formValues);
  }

  // 確認モーダルの「実行する」が押されたら、ここで初めて実際のAPI呼び出しを行う。
  function handleConfirmSubmit() {
    if (editingMaterial) {
      updateMutation.mutate({ materialId: editingMaterial.materialId, material: pendingSubmit });
    } else {
      createMutation.mutate(pendingSubmit);
    }
    setPendingSubmit(null);
  }

  function handleRequestDeactivate(materialId) {
    setPendingDeactivateId(materialId);
  }

  function handleConfirmDeactivate() {
    deactivateMutation.mutate(pendingDeactivateId);
    setPendingDeactivateId(null);
  }

  // 廃版確認モーダルに表示する対象材料(名前を出したいため一覧から探す)
  const deactivateTarget = materials.find((m) => m.materialId === pendingDeactivateId);

  function handleEdit(material) {
    setEditingMaterial(material);
    setShowForm(true); // 編集ボタンを押した時は、自動的にフォームを開く
  }

  function handleToggleForm() {
    if (showForm) {
      setEditingMaterial(null); // フォームを閉じる際、編集中のデータも解除しておく
    }
    setShowForm((prev) => !prev);
  }

  return (
    <div>
      {displayError && (
        <div className="alert alert-danger" role="alert">
          {displayError}
        </div>
      )}

      <button type="button" className="btn btn-success mb-3" onClick={handleToggleForm}>
        {showForm ? 'フォームを閉じる' : '+ 新規材料登録'}
      </button>

      <div className="row g-4">
        {showForm && (
          <div className="col-12 col-lg-4">
            <MaterialForm
              key={editingMaterial ? editingMaterial.materialId : 'new'}
              initialValue={editingMaterial ?? emptyForm}
              isEditing={!!editingMaterial}
              isSaving={isSaving}
              onSubmit={handleRequestSubmit}
              onCancelEdit={() => {
                setEditingMaterial(null);
                setShowForm(false);
              }}
            />
          </div>
        )}

        <div className={showForm ? 'col-12 col-lg-8' : 'col-12'}>
          <FilterBar
            categoryFilter={categoryFilter}
            activeFilter={activeFilter}
            onCategoryChange={setCategoryFilter}
            onActiveChange={setActiveFilter}
            onReload={() => queryClient.invalidateQueries({ queryKey: ['materials'] })}
          />

          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : (
            <MaterialTable
              materials={materials}
              onEdit={handleEdit}
              onDeactivate={handleRequestDeactivate}
              onReactivate={(id) => reactivateMutation.mutate(id)}
            />
          )}
        </div>
      </div>

      {/* 登録・編集の確認モーダル */}
      <ConfirmModal
        show={pendingSubmit !== null}
        title={editingMaterial ? 'この内容で更新します' : 'この内容で登録します'}
        confirmLabel={editingMaterial ? '更新する' : '登録する'}
        summaryLines={
          pendingSubmit
            ? [
                { label: '材料名', value: pendingSubmit.name },
                { label: '分類', value: categoryLabel(pendingSubmit.category) },
                { label: '単位系', value: baseUnitLabel(pendingSubmit.baseUnit) },
                { label: '主原料', value: pendingSubmit.mainMaterial ? 'はい' : 'いいえ' },
              ]
            : []
        }
        onConfirm={handleConfirmSubmit}
        onCancel={() => setPendingSubmit(null)}
      />

      {/* 廃版化の確認モーダル */}
      <ConfirmModal
        show={pendingDeactivateId !== null}
        title="この材料を廃版にします"
        confirmLabel="廃版にする"
        summaryLines={
          deactivateTarget
            ? [
                { label: '材料名', value: deactivateTarget.name },
                { label: '分類', value: categoryLabel(deactivateTarget.category) },
              ]
            : []
        }
        onConfirm={handleConfirmDeactivate}
        onCancel={() => setPendingDeactivateId(null)}
      />
    </div>
  );
}

function FilterBar({ categoryFilter, activeFilter, onCategoryChange, onActiveChange, onReload }) {
  return (
    <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
      <h2 className="h5 mb-0 me-auto">登録済み材料一覧</h2>

      <select
        className="form-select form-select-sm w-auto"
        value={categoryFilter}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">分類: すべて</option>
        <option value="RAW">原料のみ</option>
        <option value="ADDITIVE">添加物のみ</option>
      </select>

      <select
        className="form-select form-select-sm w-auto"
        value={activeFilter}
        onChange={(e) => onActiveChange(e.target.value)}
      >
        <option value="">状態: すべて</option>
        <option value="true">有効なもののみ</option>
        <option value="false">廃版のもののみ</option>
      </select>

      <button className="btn btn-secondary btn-sm" onClick={onReload}>
        再読み込み
      </button>
    </div>
  );
}

function MaterialTable({ materials, onEdit, onDeactivate, onReactivate }) {
  return (
    <table className="table table-striped table-hover align-middle">
      <thead>
        <tr>
          <th>ID</th>
          <th>材料名</th>
          <th>分類</th>
          <th>単位系</th>
          <th>主原料</th>
          <th>状態</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {materials.length === 0 ? (
          <tr>
            <td colSpan="7" className="text-center text-muted">
              該当する材料がありません
            </td>
          </tr>
        ) : (
          materials.map((material) => (
            <tr key={material.materialId} className={material.active ? '' : 'text-muted'}>
              <td>{material.materialId}</td>
              <td>{material.name}</td>
              <td>{categoryLabel(material.category)}</td>
              <td>{baseUnitLabel(material.baseUnit)}</td>
              <td>{material.mainMaterial ? '○' : ''}</td>
              <td>
                {material.active ? (
                  <span className="badge text-bg-success">有効</span>
                ) : (
                  <span className="badge text-bg-secondary">廃版</span>
                )}
              </td>
              <td>
                <div className="btn-group btn-group-sm gap-2">
                  {/*
                    原料は「産地」、添加物は「梱包仕様」というラベルの違いはあるが、
                    どちらも material_package_spec の登録が必要なため、両方に表示する。
                    (以前は原料のみに表示していたが、添加物にも梱包仕様(重量・単位)の
                     登録が必要なことが分かったため、全材料共通のボタンに変更した)
                  */}
                  <Link
                    to={`/masters/materials/${material.materialId}/origins`}
                    className="btn btn-secondary"
                  >
                    {material.category === 'RAW' ? '産地管理' : '梱包仕様管理'}
                  </Link>
                  <button className="btn btn-primary" onClick={() => onEdit(material)}>
                    編集
                  </button>
                  {material.active ? (
                    <button
                      className="btn btn-danger"
                      onClick={() => onDeactivate(material.materialId)}
                    >
                      廃版にする
                    </button>
                  ) : (
                    <button
                      className="btn btn-success"
                      onClick={() => onReactivate(material.materialId)}
                    >
                      復元する
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function MaterialForm({ initialValue, isEditing, isSaving, onSubmit, onCancelEdit }) {
  const [form, setForm] = useState(initialValue);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(form); // ここでは確認待ちにするだけで、APIはまだ呼ばない(親コンポーネント側で制御)
  }

  return (
    <div className="card">
      <div className="card-body">
        <h2 className="h5 card-title">{isEditing ? '材料を編集' : '新規材料登録'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="name" className="form-label">
              材料名
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-control"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label htmlFor="category" className="form-label">
              分類
            </label>
            <select
              id="category"
              name="category"
              className="form-select"
              value={form.category}
              onChange={handleChange}
            >
              <option value="RAW">原料</option>
              <option value="ADDITIVE">添加物</option>
            </select>
          </div>

          <div className="mb-3">
            <label htmlFor="baseUnit" className="form-label">
              単位系
            </label>
            <select
              id="baseUnit"
              name="baseUnit"
              className="form-select"
              value={form.baseUnit}
              onChange={handleChange}
            >
              <option value="WEIGHT">重量(g)</option>
              <option value="VOLUME">体積(ml)</option>
            </select>
          </div>

          <div className="form-check mb-3">
            <input
              id="mainMaterial"
              name="mainMaterial"
              type="checkbox"
              className="form-check-input"
              checked={form.mainMaterial}
              onChange={handleChange}
            />
            <label htmlFor="mainMaterial" className="form-check-label">
              主原料(加水率計算の基準にする)
            </label>
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-grow-1" disabled={isSaving}>
              {isSaving ? '送信中...' : isEditing ? '更新する' : '登録する'}
            </button>
            {isEditing && (
              <button type="button" className="btn btn-outline-secondary" onClick={onCancelEdit}>
                キャンセル
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

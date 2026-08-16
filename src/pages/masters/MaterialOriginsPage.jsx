import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { listMaterials } from '../../api/materialApi.js';
import {
  createPackageSpec,
  deletePackageSpec,
  listPackageSpecs,
  updatePackageSpec,
} from '../../api/packageSpecApi.js';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const emptyForm = { origin: '', packageWeight: '', packageUnitLabel: '' };

export default function MaterialOriginsPage() {
  const { materialId } = useParams();
  const numericMaterialId = Number(materialId);

  const [pendingSubmit, setPendingSubmit] = useState(null);
  const [editingSpec, setEditingSpec] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const queryClient = useQueryClient();

  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: () => listMaterials({}) });
  const { data: specs = [], isLoading } = useQuery({
    queryKey: ['packageSpecs', numericMaterialId],
    queryFn: () => listPackageSpecs(numericMaterialId),
  });

  const material = materials.find((m) => m.materialId === numericMaterialId);

  const createMutation = useMutation({
    mutationFn: (payload) => createPackageSpec(numericMaterialId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packageSpecs', numericMaterialId] });
      setEditingSpec(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ specId, payload }) => updatePackageSpec(numericMaterialId, specId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packageSpecs', numericMaterialId] });
      setEditingSpec(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (specId) => deletePackageSpec(numericMaterialId, specId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packageSpecs', numericMaterialId] }),
  });

  function handleRequestSubmit(formValues) {
    setPendingSubmit({
      ...formValues,
      packageWeight: Number(formValues.packageWeight),
    });
  }

  function handleConfirm() {
    if (editingSpec) {
      updateMutation.mutate({ specId: editingSpec.specId, payload: pendingSubmit });
    } else {
      createMutation.mutate(pendingSubmit);
    }
    setPendingSubmit(null);
  }

  return (
    <div className="container-fluid py-4">
      <Link to="/masters" className="d-inline-block mb-3">
        ← マスタ管理へ戻る
      </Link>
      <h1 className="h4 mb-4">{material ? `${material.name} の産地管理` : '産地管理'}</h1>

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <SpecForm
            key={editingSpec ? editingSpec.specId : 'new'}
            initialValue={editingSpec ?? emptyForm}
            isEditing={!!editingSpec}
            isSaving={createMutation.isPending || updateMutation.isPending}
            onSubmit={handleRequestSubmit}
            onCancelEdit={() => setEditingSpec(null)}
          />
        </div>

        <div className="col-12 col-lg-7">
          <h2 className="h5 mb-3">登録済みの産地</h2>
          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : specs.length === 0 ? (
            <p className="text-muted">まだ産地が登録されていません。</p>
          ) : (
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>産地</th>
                  <th>目安数量</th>
                  <th>単位表示</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.specId}>
                    <td>{spec.origin}</td>
                    <td>{spec.packageWeight}</td>
                    <td>{spec.packageUnitLabel}</td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => setEditingSpec(spec)}>
                          編集
                        </button>
                        <button
                          className="btn btn-outline-danger"
                          onClick={() => setPendingDeleteId(spec.specId)}
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ConfirmModal
        show={pendingSubmit !== null}
        title={editingSpec ? 'この内容で更新します' : 'この産地を登録します'}
        confirmLabel={editingSpec ? '更新する' : '登録する'}
        summaryLines={
          pendingSubmit
            ? [
                { label: '産地', value: pendingSubmit.origin },
                { label: '目安数量', value: pendingSubmit.packageWeight },
                { label: '単位表示', value: pendingSubmit.packageUnitLabel },
              ]
            : []
        }
        onConfirm={handleConfirm}
        onCancel={() => setPendingSubmit(null)}
      />

      <ConfirmModal
        show={pendingDeleteId !== null}
        title="この産地を削除します"
        confirmLabel="削除する"
        summaryLines={
          pendingDeleteId
            ? [{ label: '産地', value: specs.find((s) => s.specId === pendingDeleteId)?.origin }]
            : []
        }
        onConfirm={() => {
          deleteMutation.mutate(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}

function SpecForm({ initialValue, isEditing, isSaving, onSubmit, onCancelEdit }) {
  const [form, setForm] = useState(initialValue);

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
        <h2 className="h5 card-title">{isEditing ? '産地を編集' : '産地を追加'}</h2>
        <p className="text-muted small mb-3">
          ここでの「1件」は「1つの産地を基準とした1件分のデータ(産地名・目安数量・単位表示のセット)」を指します。
          <br />
          複数の産地を扱う場合(例:愛知・三重・新潟)は、まとめて1件で登録せず、
          「愛知」で1件登録→「三重」で1件登録、というように<strong>産地ごとに分けて1件ずつ</strong>登録してください。
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="origin" className="form-label">
              産地(1件につき1つの産地名を入力)
            </label>
            <input
              id="origin"
              name="origin"
              type="text"
              className="form-control"
              value={form.origin}
              onChange={handleChange}
              placeholder="例: 愛知(カンマ区切りでの複数入力は不可)"
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="packageWeight" className="form-label">
              1箱/袋あたりの目安数量(g/ml)
            </label>
            <input
              id="packageWeight"
              name="packageWeight"
              type="number"
              className="form-control"
              value={form.packageWeight}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="packageUnitLabel" className="form-label">
              単位表示(箱・袋・缶など)
            </label>
            <input
              id="packageUnitLabel"
              name="packageUnitLabel"
              type="text"
              className="form-control"
              value={form.packageUnitLabel}
              onChange={handleChange}
              required
            />
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

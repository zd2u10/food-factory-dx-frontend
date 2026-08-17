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

const emptyForm = { origin: '', packageWeight: '', packageUnitLabel: '', canMix: false };

/**
 * 材料ごとの梱包仕様(material_package_spec)を管理する画面。
 *
 * origin(産地)は、原料のFEFO計算(産地+賞味期限のルール)に本質的に必要な情報だが、
 * 添加物のFEFO計算は賞味期限のみで行うため、産地という概念自体が不要。
 * そのため、材料の分類(category)によって画面の見せ方を切り替える:
 *   原料(RAW)   : 「産地」として人が入力する(FEFOの産地フィルターに使われる)
 *   添加物(ADDITIVE): 産地入力欄を隠し、内部的に自動生成した値を裏側でoriginに入れておく。
 *                     画面には「梱包仕様: 20000g / 袋」のように、重量と単位だけを見せる
 */
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
  const isRaw = material?.category === 'RAW';

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
      // 添加物の場合、originは人に入力させず、ここで自動生成する
      // (originはFEFOでは使われないが、DB側がNOT NULLのため、識別用の形式的な値を入れておく)。
      origin: isRaw ? formValues.origin : `spec-${crypto.randomUUID().slice(0, 8)}`,
      packageWeight: Number(formValues.packageWeight),
      packageUnitLabel: formValues.packageUnitLabel,
      // canMixは原料のみの概念(発注時の産地グループ化に使う)。添加物は常にfalseにしておく。
      canMix: isRaw ? formValues.canMix : false,
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
      <h1 className="h4 mb-4">
        {material ? `${material.name} の${isRaw ? '産地' : '梱包仕様'}管理` : '産地・梱包仕様管理'}
      </h1>

      <div className="row g-4">
        <div className="col-12 col-lg-5">
          <SpecForm
            key={editingSpec ? editingSpec.specId : 'new'}
            initialValue={editingSpec ?? emptyForm}
            isEditing={!!editingSpec}
            isRaw={isRaw}
            isSaving={createMutation.isPending || updateMutation.isPending}
            onSubmit={handleRequestSubmit}
            onCancelEdit={() => setEditingSpec(null)}
          />
        </div>

        <div className="col-12 col-lg-7">
          <h2 className="h5 mb-3">登録済みの{isRaw ? '産地' : '梱包仕様'}</h2>
          {isLoading ? (
            <p className="text-muted">読み込み中...</p>
          ) : specs.length === 0 ? (
            <p className="text-muted">まだ登録されていません。</p>
          ) : (
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  {isRaw && <th>産地</th>}
                  <th>目安数量</th>
                  <th>単位表示</th>
                  {isRaw && <th>他産地と混在可</th>}
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {specs.map((spec) => (
                  <tr key={spec.specId}>
                    {isRaw && <td>{spec.origin}</td>}
                    <td>{spec.packageWeight}</td>
                    <td>{spec.packageUnitLabel}</td>
                    {isRaw && <td>{spec.canMix ? '○' : ''}</td>}
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
        title={editingSpec ? 'この内容で更新します' : 'この内容で登録します'}
        confirmLabel={editingSpec ? '更新する' : '登録する'}
        summaryLines={
          pendingSubmit
            ? [
                ...(isRaw ? [{ label: '産地', value: pendingSubmit.origin }] : []),
                { label: '目安数量', value: pendingSubmit.packageWeight },
                { label: '単位表示', value: pendingSubmit.packageUnitLabel },
                ...(isRaw
                  ? [{ label: '複数の産地が混在する可能性', value: pendingSubmit.canMix ? 'あり' : 'なし' }]
                  : []),
              ]
            : []
        }
        onConfirm={handleConfirm}
        onCancel={() => setPendingSubmit(null)}
      />

      <ConfirmModal
        show={pendingDeleteId !== null}
        title="この登録内容を削除します"
        confirmLabel="削除する"
        summaryLines={
          pendingDeleteId
            ? [
                {
                  label: isRaw ? '産地' : '梱包仕様',
                  value: (() => {
                    const s = specs.find((sp) => sp.specId === pendingDeleteId);
                    return isRaw ? s?.origin : `${s?.packageWeight} / ${s?.packageUnitLabel}`;
                  })(),
                },
              ]
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

function SpecForm({ initialValue, isEditing, isRaw, isSaving, onSubmit, onCancelEdit }) {
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
        <h2 className="h5 card-title">
          {isEditing ? `${isRaw ? '産地' : '梱包仕様'}を編集` : `${isRaw ? '産地' : '梱包仕様'}を追加`}
        </h2>
        {isRaw ? (
          <p className="text-muted small mb-3">
            ここでの「1件」は「1つの産地を基準とした1件分のデータ(産地名・目安数量・単位表示のセット)」を指します。
            <br />
            複数の産地を扱う場合(例:愛知・三重・新潟)は、まとめて1件で登録せず、
            「愛知」で1件登録→「三重」で1件登録、というように<strong>産地ごとに分けて1件ずつ</strong>登録してください。
          </p>
        ) : (
          <p className="text-muted small mb-3">
            添加物は産地を区別しないため、ここでは「1箱/袋あたりの重量」と「単位表示」だけを登録します。
            梱包の種類が複数ある場合(例:20kg袋と10kg缶の両方を仕入れる)は、それぞれ分けて登録してください。
          </p>
        )}
        <form onSubmit={handleSubmit}>
          {isRaw && (
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
          )}
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
          {isRaw && (
            <div className="form-check mb-3">
              <input
                id="canMix"
                name="canMix"
                type="checkbox"
                className="form-check-input"
                checked={form.canMix}
                onChange={(e) => setForm((prev) => ({ ...prev, canMix: e.target.checked }))}
              />
              <label htmlFor="canMix" className="form-check-label">
                複数の産地が混在する可能性はありますか?
              </label>
              <div className="form-text">
                チェックを入れると、発注時にこの産地は「重量・単位が一致する他の産地」と自動的にまとめられ、
                1つの選択肢(例:「愛知or三重」)として表示されます。
                この産地に限定した発注をしたい場合(例:特別レシピ用)は、チェックを入れないでください。
              </div>
            </div>
          )}
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

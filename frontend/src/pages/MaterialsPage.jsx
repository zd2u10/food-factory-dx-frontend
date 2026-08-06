import { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../api/client.js';

// フォームの初期状態。新規登録後、この状態にリセットして次の入力に備える。
const emptyForm = {
  name: '',
  category: 'RAW',
  baseUnit: 'WEIGHT',
  mainMaterial: false,
};

/**
 * 材料マスタの画面。1つの画面の中に「一覧表」と「登録フォーム」を並べて表示する
 * (画面遷移を挟まないシンプルな構成)。
 */
export default function MaterialsPage() {
  // materials: 一覧表に表示するデータ。APIから取得した配列をそのまま保持する。
  const [materials, setMaterials] = useState([]);
  // form: 入力フォームの現在の値。入力欄が変わるたびにここが更新される。
  const [form, setForm] = useState(emptyForm);
  // loading/error: 通信中かどうか、エラーが起きていないかを画面に反映するための状態。
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 画面が最初に表示された瞬間に1回だけ実行される(第2引数の空配列[]がその意味)。
  // ここで一覧データを取得しておく。
  useEffect(() => {
    loadMaterials();
  }, []);

  async function loadMaterials() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet('/materials');
      setMaterials(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // 入力欄が変更されるたびに呼ばれる。input要素のnameとvalue(またはchecked)を見て、
  // formオブジェクトの対応する項目だけを書き換える。
  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault(); // フォーム送信時のページ再読み込みを防ぐ(Reactでは自前でAPI呼び出しするため)
    setError(null);
    try {
      await apiPost('/materials', form);
      setForm(emptyForm); // 登録成功したらフォームを空に戻す
      await loadMaterials(); // 一覧を最新の状態に更新する
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="container py-4">
      <h1 className="h3 mb-4">材料マスタ</h1>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row g-4">
        {/* 左側: 登録フォーム */}
        <div className="col-12 col-lg-4">
          <div className="card">
            <div className="card-body">
              <h2 className="h5 card-title">新規登録</h2>
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

                <button type="submit" className="btn btn-primary w-100">
                  登録する
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* 右側: 一覧表 */}
        <div className="col-12 col-lg-8">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h5 mb-0">登録済み材料一覧</h2>
            <button className="btn btn-outline-secondary btn-sm" onClick={loadMaterials}>
              再読み込み
            </button>
          </div>

          {loading ? (
            <p className="text-muted">読み込み中...</p>
          ) : (
            <table className="table table-striped table-hover align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>材料名</th>
                  <th>分類</th>
                  <th>単位系</th>
                  <th>主原料</th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      まだ材料が登録されていません
                    </td>
                  </tr>
                ) : (
                  materials.map((material) => (
                    <tr key={material.materialId}>
                      <td>{material.materialId}</td>
                      <td>{material.name}</td>
                      <td>{material.category === 'RAW' ? '原料' : '添加物'}</td>
                      <td>{material.baseUnit === 'WEIGHT' ? '重量(g)' : '体積(ml)'}</td>
                      <td>{material.mainMaterial ? '○' : ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

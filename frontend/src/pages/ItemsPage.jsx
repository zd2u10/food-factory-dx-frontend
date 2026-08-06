import { useState, useEffect } from "react";
import { get, post } from "../api/client";

export default function ItemsPage() {
  // 登録済み商品のリストを保持する状態
  const [items, setItems] = useState([]);

  // フォームの入力値を保持する状態
  // なぜオブジェクトで管理するのか: 入力項目が増えてもuseStateを1つにまとめられ、更新処理も共通化できるためです
  const [formData, setFormData] = useState({
    name: "",
    safetyStockQty: "",
    targetStockQty: "",
    standardBatchQty: "",
    shelfLifeDays: 90, // デフォルト値としてJava側の現状固定値(90)を設定
  });

  // エラーメッセージ表示用
  const [error, setError] = useState("");

  // 画面表示時に一度だけ商品一覧を取得する
  useEffect(() => {
    fetchItems();
  }, []);

  // 一覧取得ロジック
  const fetchItems = async () => {
    try {
      const data = await get("/api/items");
      setItems(data);
    } catch (err) {
      setError(
        "商品一覧の取得に失敗しました。バックエンドが起動しているか確認してください。",
      );
      console.error(err);
    }
  };

  // フォーム入力時の共通処理
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 登録ボタン押下時の処理
  const handleSubmit = async (e) => {
    e.preventDefault(); // 画面の意図しないリロードを防ぐ
    setError("");

    try {
      // APIへPOST送信 (文字列から数値への変換はバックエンドのJacksonが自動で行ってくれます)
      await post("/api/items", formData);

      // 登録成功したらフォームをリセットし、一覧を再取得
      setFormData({
        name: "",
        safetyStockQty: "",
        targetStockQty: "",
        standardBatchQty: "",
        shelfLifeDays: 90,
      });
      fetchItems();
    } catch (err) {
      setError("商品の登録に失敗しました。入力内容を確認してください。");
      console.error(err);
    }
  };

  return (
    <div>
      <h2 className="mb-4">商品マスタ</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* 新規登録フォーム */}
      <div className="card mb-4">
        <div className="card-header">新規登録</div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">商品名</label>
              <input
                type="text"
                className="form-control"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="row">
              <div className="col-md-3 mb-3">
                <label className="form-label">適正在庫数</label>
                {/* BigDecimal対応のため、小数点入力(step="any")を許可 */}
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  name="safetyStockQty"
                  value={formData.safetyStockQty}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-3 mb-3">
                <label className="form-label">目標在庫数</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  name="targetStockQty"
                  value={formData.targetStockQty}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-3 mb-3">
                <label className="form-label">標準バッチ数量</label>
                <input
                  type="number"
                  step="any"
                  className="form-control"
                  name="standardBatchQty"
                  value={formData.standardBatchQty}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-3 mb-3">
                <label className="form-label">賞味期限(日)</label>
                <input
                  type="number"
                  className="form-control"
                  name="shelfLifeDays"
                  value={formData.shelfLifeDays}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary">
              登録する
            </button>
          </form>
        </div>
      </div>

      {/* 登録済み一覧テーブル */}
      <h4 className="mb-3">登録済み商品一覧</h4>
      <table className="table table-striped table-bordered">
        <thead className="table-light">
          <tr>
            <th>ID</th>
            <th>商品名</th>
            <th>適正在庫</th>
            <th>目標在庫</th>
            <th>標準バッチ</th>
            <th>賞味期限(日)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center">
                まだ商品が登録されていません
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.itemId}>
                <td>{item.itemId}</td>
                <td>{item.name}</td>
                <td>{item.safetyStockQty}</td>
                <td>{item.targetStockQty}</td>
                <td>{item.standardBatchQty}</td>
                <td>{item.shelfLifeDays}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

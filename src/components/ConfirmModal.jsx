/**
 * 共通の確認モーダル。
 *
 * 「入力・変更を伴う操作を実行する直前に、その内容をまとめて表示し、
 *  最終確認を挟む」という、アプリ全体で使い回すための共通部品。
 * 各画面は、このコンポーネントに「今どんな内容で確認したいか(summaryLines)」だけを渡し、
 * 実際にモーダルを開く/閉じる/確定するロジックは各画面側のuseStateで管理する。
 *
 * BootstrapのJS(モーダルの開閉アニメーション等)は読み込んでいないため、
 * 表示/非表示はReact側で完全に制御している(show=falseならそもそも何も描画しない)。
 *
 * props:
 *   show          : モーダルを表示するかどうか
 *   title         : モーダルの見出し(例: "この内容で登録します")
 *   summaryLines  : 確認内容の一覧。[{ label: '材料名', value: '米粉' }, ...] の形の配列
 *   confirmLabel  : 確定ボタンのラベル(省略時は "実行する")
 *   onConfirm     : 確定ボタンを押した時に呼ばれる関数
 *   onCancel      : キャンセルボタン・背景クリックで呼ばれる関数
 */
export default function ConfirmModal({
  show,
  title,
  summaryLines,
  confirmLabel = '実行する',
  onConfirm,
  onCancel,
}) {
  if (!show) {
    return null; // show=falseの間は、DOMに一切要素を作らない(非表示処理をCSSだけに頼らない)
  }

  return (
    <>
      {/* 背景の半透明の黒いオーバーレイ。クリックするとキャンセル扱いにする。 */}
      <div
        className="modal-backdrop show"
        style={{ zIndex: 1050 }}
        onClick={onCancel}
      />

      {/* モーダル本体。d-block(通常は非表示のmodalクラスを強制的に表示する)+ show を付けている。 */}
      <div className="modal d-block show" style={{ zIndex: 1055 }} tabIndex="-1">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" onClick={onCancel} aria-label="閉じる" />
            </div>

            <div className="modal-body">
              <p className="text-muted mb-3">以下の内容で間違いないか確認してください。</p>
              <dl className="row mb-0">
                {summaryLines.map((line) => (
                  <div className="col-12 d-flex border-bottom py-2" key={line.label}>
                    <dt className="me-3" style={{ minWidth: '8rem' }}>
                      {line.label}
                    </dt>
                    <dd className="mb-0">{line.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                キャンセル
              </button>
              <button type="button" className="btn btn-primary" onClick={onConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

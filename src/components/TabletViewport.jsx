/**
 * 製造画面(ManufacturingPage・BatchExecutionPage)を、タブレット横持ちサイズに
 * 固定して表示するためのラッパー。
 *
 * 【背景】製造画面はタブレットでの操作を想定して設計しているが、
 * 開発・検証環境にタブレット実機が無いため、PCの大きな画面で開くと
 * レイアウトが間延びして見え、実際のタブレットでの見え方を確認しづらい。
 * そこで、検証期間中はこのラッパーで囲むことで、PCで開いても常に
 * タブレット横持ち相当の幅(1024px、iPad横持ちの論理解像度を想定)に
 * 固定して表示できるようにしている。
 *
 * 【本来の設計との関係】要件定義では「PC・タブレットの両方で使えるよう、
 * 動的にサイズを変更する設計にする」と決めている。このラッパーは、
 * その動的設計を破棄するものではなく、検証のためだけに一時的に
 * 固定幅を上から被せているだけ。本番相当の動作(画面幅に応じて
 * 動的にレイアウトが変わる)を確認したくなったら、このラッパーの
 * 使用箇所(ManufacturingPage.jsx・BatchExecutionPage.jsxの
 * 冒頭にある <TabletViewport> タグ)を削除するだけで、
 * 元の動的なレスポンシブ設計にすぐ戻せる。
 */
export default function TabletViewport({ children }) {
  return (
    <div
      style={{
        maxWidth: '1024px',
        margin: '0 auto',
        border: '1px solid #dee2e6',
        borderRadius: '8px',
        boxShadow: '0 0 12px rgba(0,0,0,0.08)',
        minHeight: '100vh',
        backgroundColor: '#fff',
      }}
    >
      {children}
    </div>
  );
}

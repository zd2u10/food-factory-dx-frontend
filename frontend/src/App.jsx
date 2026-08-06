import MaterialsPage from './pages/MaterialsPage.jsx';

// 現時点では画面が1つ(材料マスタ)しかないため、そのままMaterialsPageを表示するだけ。
// 今後、商品マスタ・レシピマスタなど画面が増えたら、
// ここに簡単なナビゲーション(タブやサイドメニュー)を追加していく想定。
export default function App() {
  return <MaterialsPage />;
}

import { useState } from 'react';
import MaterialsTab from './MaterialsTab.jsx';

// 現時点で中身が実装済みなのは材料タブのみ。他は「準備中」の空表示にしておき、
// 今後実装するたびに、この配列にコンポーネントを追加していく想定。
const TABS = [
  { key: 'materials', label: '材料', Component: MaterialsTab },
  { key: 'items', label: '商品', Component: ComingSoon },
  { key: 'recipes', label: 'レシピ', Component: ComingSoon },
  { key: 'customers', label: '取引先', Component: ComingSoon },
  { key: 'carriers', label: '配送会社', Component: ComingSoon },
];

function ComingSoon() {
  return <p className="text-muted">この画面は準備中です。</p>;
}

/**
 * マスタ管理ページ。材料・商品・レシピ・取引先・配送会社など、
 * 更新頻度の低い基礎データの登録画面をタブでまとめている
 * (react-routerのページ遷移とは別に、タブ切り替え自体はコンポーネント内のuseStateで
 *  シンプルに管理している。タブ切り替えのためだけにURLを変える必要は薄いと判断したため)。
 */
export default function MastersPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const ActiveComponent = TABS.find((tab) => tab.key === activeTab).Component;

  return (
    <div className="container py-4">
      <h1 className="h3 mb-4">マスタ管理</h1>

      <ul className="nav nav-tabs mb-4">
        {TABS.map((tab) => (
          <li className="nav-item" key={tab.key}>
            <button
              type="button"
              className={`nav-link ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          </li>
        ))}
      </ul>

      <ActiveComponent />
    </div>
  );
}

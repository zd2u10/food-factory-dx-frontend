import { useState } from 'react';
import MaterialsTab from './MaterialsTab.jsx';
import ItemsTab from './ItemsTab.jsx';
import CustomersTab from './CustomersTab.jsx';
import CarriersTab from './CarriersTab.jsx';
import SuppliersTab from './SuppliersTab.jsx';

// 現時点で中身が実装済みなのは材料・商品タブ。
// レシピは、商品一覧の「レシピ」ボタンから遷移する独立ページ(/masters/items/:itemId/recipe)
// として実装したため、ここにはタブとして置かない。
const TABS = [
  { key: 'materials', label: '材料', Component: MaterialsTab },
  { key: 'items', label: '商品', Component: ItemsTab },
  { key: 'customers', label: '取引先', Component: CustomersTab },
  { key: 'carriers', label: '配送会社', Component: CarriersTab },
  { key: 'suppliers', label: '仕入先', Component: SuppliersTab },
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

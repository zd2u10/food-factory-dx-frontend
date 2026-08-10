import { NavLink, Outlet } from 'react-router-dom';

// 業務の流れ単位でまとめたページ一覧。ここに1つ追加するだけで、
// サイドメニューにも自動的に項目が増える(メニューとルーティングの定義がズレないようにするため)。
const NAV_ITEMS = [
  { to: '/masters', label: 'マスタ管理' },
  { to: '/procurement', label: '発注・入荷' },
  { to: '/inventory', label: '在庫' },
  { to: '/manufacturing', label: '製造' },
  { to: '/orders', label: '受注・出荷' },
];

/**
 * アプリ全体の外枠(サイドメニュー+コンテンツ表示エリア)。
 *
 * <Outlet />: react-routerが提供する「今選ばれているページの中身を、
 *   ここに差し込んでください」という目印。App.jsx側でルーティングを設定すると、
 *   URLに応じた各ページのコンポーネントが自動的にこの位置に表示される。
 *
 * <NavLink>: 通常の<a>タグと違い、クリックしてもページ全体の再読み込みが起きない
 *   (React側でURLと表示内容だけを書き換える、いわゆるSPAの動き方)。
 *   「今表示中のページ」に対応するリンクには、自動的に特別なクラス名(active)が付くため、
 *   それを利用して見た目のハイライトをCSSで表現している。
 */
export default function AppLayout() {
  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <nav className="bg-dark text-white p-3" style={{ width: '220px', flexShrink: 0 }}>
        <h2 className="h5 mb-4">食品工場DX</h2>
        <ul className="nav nav-pills flex-column gap-1">
          {NAV_ITEMS.map((item) => (
            <li className="nav-item" key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `nav-link text-white ${isActive ? 'active bg-primary' : 'text-white-50'}`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <main className="flex-grow-1 bg-light">
        <Outlet />
      </main>
    </div>
  );
}

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout.jsx';
import MastersPage from './pages/masters/MastersPage.jsx';
import ProcurementPage from './pages/procurement/ProcurementPage.jsx';
import InventoryPage from './pages/inventory/InventoryPage.jsx';
import ManufacturingPage from './pages/manufacturing/ManufacturingPage.jsx';
import OrdersPage from './pages/orders/OrdersPage.jsx';

/**
 * アプリ全体のルーティング(URLと、表示するページの対応表)。
 *
 * <Route element={<AppLayout />}> の中に他の<Route>をネスト(入れ子)させることで、
 * 「どのページを開いても、必ずAppLayout(サイドメニュー)の中に表示される」という
 * 構造を表現している。AppLayout側の<Outlet />の位置に、
 * 実際に選ばれたページ(MastersPage等)がはめ込まれる。
 *
 * <Navigate to="/masters" replace /> : "/"(トップ)にアクセスした際、
 * 自動的に"/masters"へ転送する。今回は明確な「トップページ」を作らず、
 * 常にどれか1つの業務ページが開いている状態にしたいため。
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/masters" replace />} />
          <Route path="/masters" element={<MastersPage />} />
          <Route path="/procurement" element={<ProcurementPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/manufacturing" element={<ManufacturingPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

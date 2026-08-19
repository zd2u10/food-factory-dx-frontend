import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout.jsx';
import MastersPage from './pages/masters/MastersPage.jsx';
import ItemRecipePage from './pages/masters/ItemRecipePage.jsx';
import MaterialOriginsPage from './pages/masters/MaterialOriginsPage.jsx';
import ProcurementPage from './pages/procurement/ProcurementPage.jsx';
import NewArrivalPage from './pages/procurement/NewArrivalPage.jsx';
import OrderDetailPage from './pages/procurement/OrderDetailPage.jsx';
import InventoryPage from './pages/inventory/InventoryPage.jsx';
import ManufacturingPage from './pages/manufacturing/ManufacturingPage.jsx';
import BatchExecutionPage from './pages/manufacturing/BatchExecutionPage.jsx';
import OrdersPage from './pages/orders/OrdersPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/masters" replace />} />
          <Route path="/masters" element={<MastersPage />} />
          {/* マスタ管理の「商品」タブから、特定の商品のレシピ詳細へ遷移する専用ページ */}
          <Route path="/masters/items/:itemId/recipe" element={<ItemRecipePage />} />
          {/* 材料一覧から、その材料の産地(梱包仕様)管理へ遷移する専用ページ */}
          <Route path="/masters/materials/:materialId/origins" element={<MaterialOriginsPage />} />
          <Route path="/procurement" element={<ProcurementPage />} />
          <Route path="/procurement/arrivals/new" element={<NewArrivalPage />} />
          <Route path="/procurement/orders/:orderId" element={<OrderDetailPage />} />
          {/* 発注一覧・発注詳細から直接遷移する、発注専用の入荷登録画面 */}
          <Route path="/procurement/orders/:orderId/arrivals/new" element={<NewArrivalPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/manufacturing" element={<ManufacturingPage />} />
          <Route path="/manufacturing/batches/:batchId" element={<BatchExecutionPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

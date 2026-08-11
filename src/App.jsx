import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout.jsx';
import MastersPage from './pages/masters/MastersPage.jsx';
import ItemRecipePage from './pages/masters/ItemRecipePage.jsx';
import ProcurementPage from './pages/procurement/ProcurementPage.jsx';
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
          <Route path="/procurement" element={<ProcurementPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/manufacturing" element={<ManufacturingPage />} />
          <Route path="/manufacturing/batches/:batchId" element={<BatchExecutionPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

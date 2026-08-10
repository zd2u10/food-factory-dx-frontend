import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './layout/AppLayout.jsx';
import MastersPage from './pages/masters/MastersPage.jsx';
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
          <Route path="/procurement" element={<ProcurementPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/manufacturing" element={<ManufacturingPage />} />
          {/* :batchId はURLの一部を変数として受け取る記法。BatchExecutionPage側でuseParams()から取り出す */}
          <Route path="/manufacturing/batches/:batchId" element={<BatchExecutionPage />} />
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

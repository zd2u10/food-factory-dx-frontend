import { useState } from 'react';
import DraftListTab from './DraftListTab.jsx';
import PlanByDateTab from './PlanByDateTab.jsx';
import MrpTab from './MrpTab.jsx';
import TabletViewport from '../../components/TabletViewport.jsx';

const TABS = [
  { key: 'drafts', label: 'Draft一覧', Component: DraftListTab },
  { key: 'plan', label: '予定(日別)', Component: PlanByDateTab },
  { key: 'mrp', label: 'MRP', Component: MrpTab },
];

export default function ManufacturingPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key);
  const ActiveComponent = TABS.find((tab) => tab.key === activeTab).Component;

  return (
    <TabletViewport>
      <div className="container-fluid py-4">
        <h1 className="h3 mb-4">製造</h1>

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
    </TabletViewport>
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// index.htmlの<div id="root">を探し出し、その中にAppコンポーネントを描画する。
// これがReactアプリ全体の起動地点(エントリーポイント)。
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

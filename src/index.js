import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Clip from './clip';
import Sidebar from './sidebar';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Sidebar />
    <Clip />
  </React.StrictMode>
);

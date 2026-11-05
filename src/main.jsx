import React from 'react';
import { createRoot } from 'react-dom/client';

// Bootstrap styles and interactive bundle
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

// jQuery setup
import $ from 'jquery';
window.$ = $;
window.jQuery = $;

import App from './App';
import './index.css';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

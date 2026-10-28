import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './utils/monaco.js';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/editor.css';
import './styles/review.css';
import './styles/history.css';
import './styles/stats.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);

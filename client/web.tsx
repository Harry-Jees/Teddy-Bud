import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './web.css';

// React Native Web's Animated cleanup uses the Node-style `global` name.
// Metro provides it for native bundles; Vite's browser bundle needs this shim.
const browserRuntime = globalThis as typeof globalThis & { global?: typeof globalThis };
browserRuntime.global ??= browserRuntime;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The app root element was not found.');
}

createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

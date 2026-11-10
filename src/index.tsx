import 'core-js/stable';
import 'regenerator-runtime/runtime';

import React from 'react';
import ReactDOM from 'react-dom/client';
import process from 'process';
import { Buffer } from 'buffer';
import './index.css';
import App from './App';

if (typeof globalThis.process === 'undefined') {
  (globalThis as typeof globalThis & { process: typeof process }).process = process;
}

if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as typeof globalThis & { Buffer: typeof Buffer }).Buffer = Buffer;
}

const container = document.getElementById('root');

if (!container) {
  throw new Error('Failed to find the root element');
}

const root = ReactDOM.createRoot(container);

const StartupError: React.FC<{ message: string }> = ({ message }) => (
  <div
    style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#0b0b0b',
      color: '#e5e5e5',
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ fontSize: 20, margin: '0 0 12px' }}>Vector UI is not configured</h1>
      <p style={{ margin: '0 0 12px', color: '#f87171' }}>{message}</p>
      <p style={{ margin: 0, lineHeight: 1.5, color: '#a3a3a3' }}>
        Set REACT_APP_OPEN_BALENA_API_URL (a public https URL for your openBalena API) and, if you use the built-in
        terminal or image tools, REACT_APP_VECTOR_SERVER_URL. On Vercel add them under Project Settings, Environment
        Variables, then redeploy: they are read at build time.
      </p>
    </div>
  </div>
);

import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  })
  .catch((error: unknown) => {
    console.error(error);
    root.render(<StartupError message={error instanceof Error ? error.message : String(error)} />);
  });

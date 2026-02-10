import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

// Ensure process.env exists for the Gemini SDK to prevent crashes
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: { API_KEY: '' } };
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Critical Error: Root element 'root' not found in DOM.");
}
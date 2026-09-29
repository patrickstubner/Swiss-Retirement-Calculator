import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { FehlerGrenze } from './ui/FehlerGrenze';
import './ui/styles.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <FehlerGrenze>
        <App />
      </FehlerGrenze>
    </StrictMode>,
  );
}

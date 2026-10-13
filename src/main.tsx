import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/pirata-one/latin-400';
import '@fontsource/big-shoulders-stencil-display/latin-700';
import '@fontsource/big-shoulders-stencil-display/latin-800';
import '@fontsource/big-shoulders-stencil-display/latin-900';
import '@fontsource/barlow-condensed/latin-500';
import '@fontsource/barlow-condensed/latin-600';
import '@fontsource/barlow-condensed/latin-700';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { App } from './App';
import { requestPersistence } from './db/schema';

void requestPersistence();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

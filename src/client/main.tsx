import '@fontsource-variable/eb-garamond';
import '@fontsource-variable/eb-garamond/wght-italic.css';
import '@fontsource-variable/inter';
import './styles/theme.css';
import './styles/base.css';
import './styles/forms.css';
import './styles/components.css';
import './styles/checkbox.css';
import './styles/pantry-editor.css';
import './styles/settings.css';
import './styles/layout.css';
import './styles/sheet.css';
import './styles/dictation.css';
import './styles/recipe.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { refreshOnReturn } from './data-events.ts';
import { registerServiceWorker } from './push.ts';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

refreshOnReturn();
void registerServiceWorker();

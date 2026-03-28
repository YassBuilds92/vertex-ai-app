import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PresentationPage } from './PresentationPage';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PresentationPage />
  </StrictMode>,
);

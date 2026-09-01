import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import StockingApp from '@/stocking/StockingApp';
import LoginGate from '@/stocking/auth/LoginGate';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginGate>
      <StockingApp />
    </LoginGate>
  </StrictMode>,
);

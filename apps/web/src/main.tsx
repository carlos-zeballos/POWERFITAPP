import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import Home from './site/Home';

// La app interna se carga aparte para que el sitio público sea liviano (Lighthouse).
const AppRoutes = lazy(() => import('./app/AppRoutes'));

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-dvh bg-black" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/*" element={<AppRoutes />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

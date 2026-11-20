'use client';
import dynamic from 'next/dynamic';

// localStorage só existe no navegador: renderiza apenas no cliente
const App = dynamic(() => import('./App'), { ssr: false });

export default function AppClient() {
  return <App />;
}

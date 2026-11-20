# Scale Lab

Simulador de arquitetura: monte o circuito (usuários → gateway → backend → cache → banco),
configure cada peça e veja gargalos, latência e erros. Tudo fica no localStorage.

## Rodar local (Docker, sem npm no host)
    docker compose up
    # abre http://localhost:3000

## Deploy
Suba o repo no GitHub e importe na Vercel (framework Next.js, sem variáveis de ambiente).

## Estrutura
- src/lib/sim.ts      motor de simulação (função pura)
- src/lib/catalog.ts  tipos de nó, defaults e campos editáveis
- src/lib/store.ts    estado + persistência (zustand/localStorage)
- src/components/     canvas (React Flow), nó, inspector

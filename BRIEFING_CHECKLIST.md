# BRIEFING TÉCNICO: RECUPERAÇÃO E EXIBIÇÃO DE CHECKLIST NO MOBILE (AUTO-PEÇA & GESTÃO)

## 1. OBJETIVO DA IMPLEMENTAÇÃO

Resolver as seguintes necessidades operacionais do aplicativo móvel React Native / Expo:
1. **Recuperação e Exibição Completa de Checklists:** Permitir que o mecânico/vistoriador no pátio consulte e visualize todos os dados de vistorias preenchidas de uma Ordem de Serviço (KM, combustível, pertences, observações, catálogo de itens inspecionados com notas, avarias com fotos ampliáveis e assinatura digital do cliente).
2. **Dinâmica do Botão no Pátio:** 
   - Se a OS **já possui checklist preenchido**, o botão principal do card exibe **"Mostrar Checklist"** (abrindo o visualizador detalhado). Se apenas o checklist de entrada foi feito, exibe também um botão secundário **"+ Saída"** para agilizar a entrega do veículo.
   - Se a OS **não possui checklist**, o botão exibe **"Fazer Checklist"** (iniciando o formulário de vistoria de entrada).
3. **Prevenção de Conflitos (HTTP 409):** Ao abrir o formulário de checklist para uma OS que já tem entrada, o app seleciona automaticamente o tipo `saida` e herda a quilometragem e pertences da entrada. Se ambos já foram preenchidos, avisa o usuário e impede submissões duplicadas.

---

## 2. ARQUITETURA E ARQUIVOS MODIFICADOS

### A. Camada de API (`src/api/checklistApi.ts`)
- `obterChecklistsDaOS(osId: string)`: Realiza `GET /api/os/{osId}/checklists` e retorna a lista de vistorias gravadas.
- `obterUrlLeitura(caminho: string)`: Converte o caminho de bucket/armazenamento local (ex: `tenant/avarias/uuid.jpg` ou `/api/arquivos/local/...`) em URL HTTP acessível pelo app via `POST /api/arquivos/url-de-leitura`, prefixando o `API_BASE_URL` quando em rota local de desenvolvimento.

### B. Componente Visualizador (`src/components/ChecklistDetalhesModal.tsx`)
- Modal completo com:
  - Cabeçalho com placa Mercosul estilizada (`PlacaVeiculo`), número da OS, cliente e veículo.
  - Abas de alternância entre vistoria de **Entrada** e **Saída**.
  - Badge de segurança indicando pendências críticas (`X itens com ressalva` ou `100% aprovado`).
  - Odômetro formatado e medidor gráfico de nível de combustível (barra colorida com percentual).
  - Lista de pertences do veículo em chips/tags.
  - Seções canônicas de vistoria (Documentação, Exterior, Interior, Pneus, Fluidos, Elétrica, Motor, Segurança) com badges de resposta (`OK`, `Atenção`, `Crítico`, `N/A`) e notas.
  - Fotos de avarias carregadas dinamicamente com modal fullscreen ao tocar na imagem.
  - Assinatura digital do cliente renderizada com borda e legenda de confirmação.
  - Botão de ação rápida para preencher o checklist de saída caso falte.

### C. Tela do Pátio (`src/screens/PatioScreen.tsx`)
- `checklistsPorOS: Record<string, RespostaChecklist[]>`: Estado que mapeia os checklists existentes para cada OS listada.
- No carregamento (`carregarOS`), dispara busca em paralelo (`Promise.all`) para sincronizar o status de vistoria de cada OS.
- Cards das OSs agora possuem:
  - Tag indicadora do status:
    - `Checklists Entrada e Saída Concluídos` (verde).
    - `Checklist de Entrada Preenchido` (azul claro).
    - `Checklist Pendente` (âmbar).
  - Botão principal condicional:
    - Se tem checklist: **"Mostrar Checklist"** (ícone de olho, azul).
    - Se tem entrada mas falta saída: botão **"+ Saída"** (verde).
    - Se não tem checklist: **"Fazer Checklist"** (ícone de prancheta, azul royal).

### D. Tela de Checklist (`src/screens/ChecklistScreen.tsx`)
- Aceita parâmetro de rota `tipoInicial?: 'entrada' | 'saida'`.
- Ao inicializar sem rascunho em disco, verifica se a OS já possui entrada. Se sim, chaveia para `saida`, preenchendo o KM e pertences de forma inteligente.
- Impede tentativas de duplicar checklists já finalizados.

---

## 3. INSTRUÇÕES PARA VALIDAÇÃO E EXECUÇÃO

Para testar e validar o funcionamento no terminal:

```bash
# 1. Typecheck estrito do TypeScript (deve retornar 0 erros)
npx tsc --noEmit

# 2. Diagnóstico de dependências e ambiente Expo (deve passar 18/18 checks)
npx expo-doctor

# 3. Teste de build/exportação dos bundles Metro iOS e Android
npx expo export --no-bytecode
```

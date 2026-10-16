# Auto-Peça & Gestão — Aplicativo Mobile (Expo / React Native)

Aplicativo móvel em **React Native com Expo e TypeScript** para o sistema de gestão de oficinas mecânicas e auto-peças, projetado para operação ágil no pátio e chão de oficina.

---

## 🚀 Funcionalidades Principais

### 1. 🔍 Consulta de Estoque & Leitor de Código de Barras
- **Busca rápida instantânea** por descrição, código interno, código OEM ou fabricante.
- **Leitor de Código de Barras e EAN/GTIN pela Câmera:** com retículo de mira e lanterna/flash, preenchendo automaticamente o campo de busca.
- **Destaque Visual:**
  - **Saldo Disponível:** indicador verde (se > 0) e vermelho (se zerado/negativo).
  - **Localização no Estoque:** prateleira, gaveta ou corredor em destaque azul para agilizar a separação física de peças.
  - Preço formatado em R$, código OEM e fabricante.
  - Ficha detalhada da peça com toque no card.

### 2. 📋 Checklist do Carro (Entrada & Saída) — Prioridade Máxima
Wizard completo e passo a passo projetado para o mecânico ou recepcionista em volta do veículo:
- **Passo 1 — Dados Básicos:**
  - Alternância entre Checklist de **Entrada** (recepção) ou **Saída** (entrega).
  - Odômetro atual (KM numérico).
  - Marcador de combustível (0%, 25%, 50%, 75%, 100%).
  - Checkboxes de pertences no porta-malas/cabine (estepe, macaco, manual, etc. + adicionar personalizado).
  - Observações gerais da recepção.
- **Passo 2 — Vistoria Rápida (Catálogo de Perguntas):**
  - Agrupamento pelas seções canônicas: `documentacao`, `exterior`, `interior`, `pneus`, `fluidos`, `eletrica`, `motor` e `seguranca`.
  - Botões grandes de toque único: **OK** (verde), **Atenção** (amarelo), **Crítico** (vermelho) e **N/A** (cinza).
  - Abertura de campo de observação descritiva ao marcar Atenção ou Crítico.
  - Contadores em tempo real de itens críticos e de atenção.
- **Passo 3 — Catalogação de Avarias com Foto:**
  - Seletor de região do veículo (`capo`, `teto`, `porta-malas`, `para-choque-dianteiro`, `para-choque-traseiro`, `lateral-esquerda`, `lateral-direita`, `parabrisa`, `vidro-traseiro`, `rodas`).
  - Seletor de tipo de avaria (`risco`, `amassado`, `trinca`, `pintura`, `falta`, `oxidacao`).
  - Captura de foto diretamente pela câmera ou seleção na galeria.
  - Compressão e redimensionamento automático via `expo-image-manipulator` (máx 1600px, JPEG qualidade 0.8) para economizar dados no pátio.
- **Passo 4 — Assinatura Digital do Cliente:**
  - Pad de assinatura digital vetorial colhida na tela do celular com o dedo.
  - Botões para limpar e confirmar a assinatura.
  - Pré-visualização da assinatura colhida.
- **Passo 5 — Revisão e Envio com URLs Assinadas:**
  - Resumo de todos os dados preenchidos.
  - Upload automático em background: solicitação de URLs assinadas (`POST /api/arquivos/url-de-envio`), envio binário via HTTP PUT para as fotos e assinatura, e submissão final (`POST /api/os/{osId}/checklists`).

### 3. 🚗 Pátio de Ordens de Serviço (OS)
- Listagem em tempo real das ordens abertas no pátio.
- **Visual com Destaque:**
  - Placa do veículo estilizada no padrão Mercosul.
  - Modelo, cliente e box onde o carro está alocado.
  - Badge colorido de status da OS (`recebido`, `diagnostico`, `em_execucao`, `pronto`, etc.).
- Filtro por abas de status (Todas, Recebido, Diagnóstico, Em Execução, Pronto).
- Busca rápida por Placa ou Nome do Cliente.
- Botão direto **"Fazer Checklist"** com dados pré-carregados no formulário.
- Botão **"Vistorias"** para consultar o histórico de checklists já realizados naquele veículo.

### 4. 🏢 Suporte Multi-Oficina / Multi-Tenant Nativo
- **Login com Múltiplas Oficinas:** se o usuário participa de mais de uma filial e não especificou a oficina, a API retorna `tokenAcesso: null` e o app abre automaticamente a tela modal de escolha de filial.
- **Troca de Oficina sem Deslogar:** na aba "Oficina" (Perfil), o usuário visualiza sua filial ativa e pode tocar em qualquer outra filial permitida para trocar de tenant instantaneamente (`POST /api/auth/trocar-oficina`).

### 5. 🌐 Configuração Dinâmica de Servidor / IP
- Seletor de servidor integrado tanto na tela de login quanto na tela de perfil:
  - Wi-Fi Local (ex: `http://192.168.2.6:8080`)
  - Emulador Android (`http://10.0.2.2:8080`)
  - Localhost (`http://localhost:8080`)
  - Digitação de qualquer IP personalizado com botão de **"Testar Conexão"** (ping em `/api/saude`).

---

## ⚙️ Arquitetura do Projeto

```
src/
├── api/
│   ├── clienteHttp.ts       # Axios configurado com SecureStore, timeout e interceptors
│   ├── authApi.ts           # Login, troca de oficina e perfil (/api/me)
│   ├── estoqueApi.ts        # Consulta e busca de peças (/api/pecas)
│   ├── osApi.ts             # Listagem de OS do pátio (/api/os)
│   └── checklistApi.ts      # Perguntas, upload assinado PUT e gravação de checklist
├── context/
│   └── AuthContext.tsx      # Gerenciamento de sessão, tenant ativo e SecureStore
├── constants/
│   └── index.ts             # Cores semânticas, rótulos de avarias, seções e servidores
├── components/
│   ├── BarcodeScannerModal.tsx        # Leitor de código de barras com expo-camera
│   ├── AvariaPhotoCaptureModal.tsx    # Modal de fotos de avarias + compressão
│   ├── SignaturePadModal.tsx          # Canvas de assinatura do cliente na tela
│   ├── PlacaVeiculo.tsx               # Componente visual de placa Mercosul
│   ├── StatusBadge.tsx                # Badges coloridos de status de OS
│   └── ConfiguradorServidorModal.tsx  # Seletor e teste de IP da API
├── screens/
│   ├── LoginScreen.tsx      # Autenticação com seleção de filial
│   ├── PatioScreen.tsx      # Pátio com cards de OS e histórico
│   ├── EstoqueScreen.tsx    # Busca de estoque com scanner e localização
│   ├── ChecklistScreen.tsx  # Wizard 5 passos (KM, Perguntas, Avarias, Assinatura)
│   └── PerfilScreen.tsx     # Dados do usuário e troca de oficina
├── navigation/
│   └── AppNavigator.tsx     # Bottom Tabs (Pátio, Estoque, Oficina) + Stack do Checklist
└── types/
    └── index.ts             # Tipagens e DTOs estritos em TypeScript
```

---

## 🛠️ Como Executar

### Pré-requisitos
- Node.js LTS (>= 20)
- Backend Spring Boot em execução (padrão porta `8080`)

### Instalação e Execução
```bash
# Iniciar o servidor de desenvolvimento Expo
npx expo start

# Para abrir no Android
npx expo start --android

# Para abrir no iOS
npx expo start --ios
```

### Verificação de Tipagem e Diagnóstico
```bash
# Typecheck TypeScript (100% limpo)
npx tsc --noEmit

# Diagnóstico de integridade Expo
npx expo-doctor
```

---

## 🔑 Credenciais Semeadas para Teste

O banco de desenvolvimento possui usuários de teste pré-configurados:

- **E-mail:** `airton@aftecnologia.com.br`
- **Senha:** `oficina@2026`
- **Cenário Multi-Oficina:** Este usuário participa de **2 oficinas**:
  1. `Holandês Auto Peças` (ID: `11111111-1111-4111-8111-111111111111`)
  2. `Oficina Vale Verde` (ID: `22222222-2222-4222-8222-222222222222`)
- Ao fazer login sem informar a oficina, o app demonstra o fluxo automático de seleção de filial.

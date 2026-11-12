# BRIEFING TÉCNICO: LOGIN POR BIOMETRIA NO APP MOBILE (FINGERPRINT / FACE ID)

---

## 1. OBJETIVO DA FUNCIONALIDADE

Proporcionar aos colaboradores da oficina (mecânicos, atendentes, gerentes e caixas) uma experiência de **acesso rápido, seguro e sem atrito**, permitindo autenticar-se no aplicativo móvel utilizando a **biometria nativa do smartphone** (impressão digital, Face ID ou reconhecimento facial), eliminando a necessidade de redigitar e-mail e senha a cada abertura do app no ambiente de oficina.

---

## 2. REQUISITOS TÉCNICOS & DE SEGURANÇA

### 2.1. Tecnologias e Bibliotecas
- **`expo-local-authentication`** (já instalado e configurado no projeto):
  - Detecção de hardware: `LocalAuthentication.hasHardwareAsync()`
  - Verificação de cadastro no SO: `LocalAuthentication.isEnrolledAsync()`
  - Identificação do tipo biométrico: `LocalAuthentication.supportedAuthenticationTypesAsync()` (Impressão Digital vs Reconhecimento Facial / Face ID)
  - Execução da autenticação: `LocalAuthentication.authenticateAsync()`
- **`expo-secure-store`** (já instalado e configurado no projeto):
  - Armazenamento criptografado no hardware de segurança (Android Keystore / iOS Keychain) das credenciais ou token de renovação da sessão.

### 2.2. Chaves de Armazenamento Seguro (`CONFIG_STORAGE_KEYS`)
No arquivo `src/constants/index.ts`:
- `BIOMETRIA_ATIVADA`: `'af_gestao_biometria_ativada'` (booleano em string: `'true' | 'false'`)
- `BIOMETRIA_ULTIMO_EMAIL`: `'af_gestao_biometria_ultimo_email'` (e-mail da conta vinculada)
- `BIOMETRIA_ULTIMO_NOME`: `'af_gestao_biometria_ultimo_nome'` (nome do usuário para exibir na tela de boas-vindas)
- `BIOMETRIA_CREDENCIAL`: `'af_gestao_biometria_credencial'` (payload encriptado com as credenciais ou token para reautenticação automática)

---

## 3. FLUXOS DE EXPERIÊNCIA DO USUÁRIO (UX)

### Fluxo A: Primeiro Acesso e Oferta de Ativação
1. O usuário abre o aplicativo e realiza o login tradicional preenchendo **E-mail** e **Senha**.
2. Após a autenticação bem-sucedida na API:
   - O app verifica se o dispositivo possui hardware biométrico ativo e cadastrado.
   - Se possuir e a biometria ainda não estiver configurada no app:
     - Exibe um diálogo ou modal amigável:
       > **"Deseja ativar o acesso por biometria?"**  
       > *"Acesse sua oficina com rapidez e segurança usando [Impressão Digital / Face ID] nas próximas vezes."*  
       > Botões: `[ Agora Não ]` ou `[ Ativar Biometria ]`
3. Se o usuário tocar em **Ativar Biometria**:
   - Aciona uma verificação biométrica imediata de confirmação.
   - Sendo aprovada, salva a preferência e as chaves no `SecureStore`.

### Fluxo B: Login Recorrente com Biometria
1. O usuário abre o app já configurado com biometria.
2. A tela de login detecta que há uma conta salva com biometria ativa.
3. A interface apresenta um **Card de Boas-Vindas Personalizado**:
   - Nome do colaborador (ex: *"Olá, Carlos!"*).
   - E-mail associado.
   - Botão em destaque: **"Entrar com Impressão Digital"** ou **"Entrar com Face ID"** (com ícone visual de biometria).
4. Ao tocar no botão (ou automaticamente se configurado):
   - Abre o prompt nativo do sistema operacional.
   - Sucesso biométrico ➔ Recupera as credenciais criptografadas, valida na API / AuthContext e redireciona imediatamente para o Pátio.
5. Link alternativo: **"Entrar com outra conta ou senha"** (reverte para os campos tradicionais de e-mail e senha).

### Fluxo C: Fallback e Falhas de Reconhecimento
1. Se a biometria falhar ou o operador cancelar o prompt biométrico:
   - O app exibe mensagem clara: *"Biometria não reconhecida ou cancelada"*.
   - Mantém os campos de e-mail (já preenchido) e senha visíveis para que o usuário possa digitar a senha manualmente sem qualquer bloqueio.
2. Em caso de alteração das biometrias no sistema operacional (ex: dedo removido ou nova face cadastrada):
   - O `SecureStore` invalida com segurança a chave e o app solicita que o usuário faça login com senha tradicional uma vez para revalidar a biometria.

### Fluxo D: Gerenciamento nas Configurações (Perfil)
1. Na tela de `PerfilScreen.tsx`:
   - Seção **"Segurança & Acesso"**:
     - Switch: **"Login por Biometria (Digital / Face ID)"**.
     - Permite ao operador ligar ou desligar a biometria a qualquer momento.

---

## 4. MATRIZ DE CASOS DE BORDA & TRATAMENTO DE ERROS

| Cenário de Teste | Comportamento Esperado |
|---|---|
| Dispositivo sem sensor biométrico | O app não exibe opção de biometria na tela de login e nem o switch nas configurações. |
| Sensor biométrico sem digitais cadastradas no SO | Exibe aviso sugerindo cadastrar biometria nas configurações do celular antes de ativar. |
| Operador cancelou a leitura biométrica | Permanece na tela de login com opção de tentar novamente ou digitar senha. |
| Token expirado ou credencial alterada no backend | Limpa as credenciais salvas e solicita digitação de senha atualizada. |
| Logout explícito pelo usuário | Mantém a opção de biometria ativa para o último usuário ou permite limpar ao trocar de conta. |

---

## 5. ARQUIVOS A CRIAR E MODIFICAR

1. **`src/constants/index.ts`**:
   - Adicionar chaves de armazenamento para biometria no `CONFIG_STORAGE_KEYS`.
2. **`src/utils/biometriaLoginHelper.ts`** *(novo)*:
   - Funções auxiliares para consultar suporte, salvar credenciais biométricas, limpar biometria e obter rótulo do sensor (Face ID vs Digital).
3. **`src/context/AuthContext.tsx`**:
   - Métodos: `loginComBiometria()`, `ativarBiometriaLogin()`, `desativarBiometriaLogin()`, e estado `temBiometriaAtiva`.
4. **`src/screens/LoginScreen.tsx`**:
   - Detecção de biometria ao carregar a tela.
   - Card de boas-vindas com botão de acesso biométrico rápido.
   - Alternância fluida entre "Modo Biométrico" e "Modo Senha Tradicional".
   - Diálogo pós-login para sugerir ativação se ainda não estiver ativa.
5. **`src/screens/PerfilScreen.tsx`**:
   - Item com switch para ativar/desativar biometria nas preferências do usuário.

---

## 6. CRITÉRIOS DE ACEITAÇÃO

- [ ] Usuário consegue ativar biometria após efetuar login tradicional com sucesso.
- [ ] Ao reabrir o app, o botão de login biométrico aparece em destaque com o nome do usuário.
- [ ] Autenticação pelo sensor do dispositivo valida com sucesso e direciona para o Pátio.
- [ ] Cancelamento da biometria não trava o app e permite digitação da senha.
- [ ] Opção de trocar de conta ou usar senha acessível a qualquer momento.
- [ ] Configuração de ligar/desligar disponível e funcional na tela de Perfil.
- [ ] Checagem `tsc --noEmit` executando com zero erros de tipagem.

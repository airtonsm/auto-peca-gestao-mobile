import { UsuarioMe } from '../types';

/**
 * Verifica se o usuário autenticado possui permissão para faturar no caixa
 * (Papéis autorizados: Caixa, Administrador, Gestor, Financeiro ou permissão 'os.faturar').
 */
export function podeFaturarCaixa(usuario: UsuarioMe | null): boolean {
  if (!usuario) return false;

  const papelNormalizado = (usuario.papel || '').toLowerCase().trim();

  // Papéis autorizados por natureza
  const papeisAutorizados = [
    'admin',
    'administrador',
    'gestor',
    'financeiro',
    'caixa',
  ];

  if (papeisAutorizados.includes(papelNormalizado)) {
    return true;
  }

  // Permissões explícitas concedidas pelo Administrador (matriz de permissões)
  const permissoes = Array.isArray(usuario.permissoes) ? usuario.permissoes : [];
  const permissoesFaturamento = [
    'os.faturar',
    'peca.vender',
  ];

  return permissoes.some((p) => permissoesFaturamento.includes(p.toLowerCase()));
}

// Alias para compatibilidade
export const podeFaturarEEmitirNota = podeFaturarCaixa;

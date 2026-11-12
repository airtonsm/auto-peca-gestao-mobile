/**
 * Utilitários para formatação e máscaras de campos em cadastros mobile (Fast-Create)
 */

export const limparApenasNumeros = (valor: string): string => {
  return (valor || '').replace(/\D/g, '');
};

export const mascaraTelefone = (valor: string): string => {
  const nums = limparApenasNumeros(valor).slice(0, 11);
  if (nums.length === 0) return '';
  if (nums.length <= 2) return `(${nums}`;
  if (nums.length <= 6) return `(${nums.slice(0, 2)}) ${nums.slice(2)}`;
  if (nums.length <= 10) {
    return `(${nums.slice(0, 2)}) ${nums.slice(2, 6)}-${nums.slice(6)}`;
  }
  return `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7, 11)}`;
};

export const mascaraCpf = (valor: string): string => {
  const nums = limparApenasNumeros(valor).slice(0, 11);
  if (nums.length === 0) return '';
  if (nums.length <= 3) return nums;
  if (nums.length <= 6) return `${nums.slice(0, 3)}.${nums.slice(3)}`;
  if (nums.length <= 9) return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6)}`;
  return `${nums.slice(0, 3)}.${nums.slice(3, 6)}.${nums.slice(6, 9)}-${nums.slice(9, 11)}`;
};

export const mascaraCnpj = (valor: string): string => {
  const nums = limparApenasNumeros(valor).slice(0, 14);
  if (nums.length === 0) return '';
  if (nums.length <= 2) return nums;
  if (nums.length <= 5) return `${nums.slice(0, 2)}.${nums.slice(2)}`;
  if (nums.length <= 8) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5)}`;
  if (nums.length <= 12) return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8)}`;
  return `${nums.slice(0, 2)}.${nums.slice(2, 5)}.${nums.slice(5, 8)}/${nums.slice(8, 12)}-${nums.slice(12, 14)}`;
};

export const mascaraCpfCnpj = (valor: string, tipo?: 'pf' | 'pj'): string => {
  const nums = limparApenasNumeros(valor);
  if (tipo === 'pj' || nums.length > 11) {
    return mascaraCnpj(nums);
  }
  return mascaraCpf(nums);
};

export const normalizarPlaca = (valor: string): string => {
  return (valor || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 7);
};

export const mascaraPlacaExibicao = (valor: string): string => {
  const limpa = normalizarPlaca(valor);
  if (limpa.length <= 3) return limpa;
  return `${limpa.slice(0, 3)}-${limpa.slice(3)}`;
};

export const mascaraMoeda = (valor: string | number): string => {
  if (typeof valor === 'number') {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const digitos = limparApenasNumeros(valor);
  if (!digitos) return '';
  const num = parseInt(digitos, 10) / 100;
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const converterMoedaParaNumero = (valor: string): number => {
  if (!valor) return 0;
  const digitos = limparApenasNumeros(valor);
  if (!digitos) return 0;
  return parseInt(digitos, 10) / 100;
};

// Constantes e configurações da aplicação

export const CONFIG_STORAGE_KEYS = {
  TOKEN: 'af_gestao_token',
  USER: 'af_gestao_user',
  OFICINA_ATIVA: 'af_gestao_oficina_ativa',
  API_BASE_URL: 'af_gestao_api_base_url',
};

// URL padrão para a API backend
export const DEFAULT_API_URL = 'http://192.168.2.6:8080';

export const SERVIDORES_PREDEFINIDOS = [
  { label: 'Nuvem Produção (af-gestao-oficina.web.app)', value: 'https://af-gestao-oficina.web.app' },
  { label: 'Wi-Fi Local (192.168.2.6:8080)', value: 'http://192.168.2.6:8080' },
  { label: 'Emulador Android (10.0.2.2:8080)', value: 'http://10.0.2.2:8080' },
  { label: 'Rede Local Secundária (10.10.10.24:8080)', value: 'http://10.10.10.24:8080' },
  { label: 'Localhost (127.0.0.1:8080)', value: 'http://localhost:8080' },
];

export const CORES = {
  primaria: '#2563EB',
  primariaEscura: '#1D4ED8',
  primariaClara: '#60A5FA',
  fundo: '#0F172A',
  superficie: '#1E293B',
  superficieClara: '#334155',
  borda: '#475569',
  bordaSuave: '#334155',
  texto: '#F8FAFC',
  textoSecundario: '#94A3B8',
  textoMudo: '#64748B',
  sucesso: '#16A34A',
  sucessoFundo: '#14532D',
  sucessoTexto: '#86EFAC',
  alerta: '#D97706',
  alertaFundo: '#78350F',
  alertaTexto: '#FDE68A',
  perigo: '#DC2626',
  perigoFundo: '#7F1D1D',
  perigoTexto: '#FCA5A5',
  cinza: '#64748B',
  cinzaFundo: '#1E293B',
  branco: '#FFFFFF',
  preto: '#000000',
  placaFundo: '#FFFFFF',
  placaBorda: '#000000',
  placaFaixaAzul: '#003399',
};

export const ROTULOS_SECAO: Record<string, { titulo: string; icone: string }> = {
  documentacao: { titulo: 'Documentação', icone: 'file-text' },
  exterior: { titulo: 'Exterior & Lataria', icone: 'eye' },
  interior: { titulo: 'Interior & Bancos', icone: 'truck' },
  pneus: { titulo: 'Pneus & Rodas', icone: 'disc' },
  fluidos: { titulo: 'Fluidos & Níveis', icone: 'droplet' },
  eletrica: { titulo: 'Sistema Elétrico', icone: 'zap' },
  motor: { titulo: 'Motor & Câmbio', icone: 'settings' },
  seguranca: { titulo: 'Itens de Segurança', icone: 'shield' },
};

export const REGIOES_AVARIA: Array<{ id: string; rotulo: string }> = [
  { id: 'para-choque-dianteiro', rotulo: 'Para-choque Dianteiro' },
  { id: 'para-choque-traseiro', rotulo: 'Para-choque Traseiro' },
  { id: 'capo', rotulo: 'Capô' },
  { id: 'teto', rotulo: 'Teto' },
  { id: 'porta-malas', rotulo: 'Porta-malas' },
  { id: 'lateral-esquerda', rotulo: 'Lateral Esquerda' },
  { id: 'lateral-direita', rotulo: 'Lateral Direita' },
  { id: 'parabrisa', rotulo: 'Para-brisa' },
  { id: 'vidro-traseiro', rotulo: 'Vidro Traseiro' },
  { id: 'rodas', rotulo: 'Rodas / Calotas' },
];

export const TIPOS_AVARIA: Array<{ id: string; rotulo: string }> = [
  { id: 'risco', rotulo: 'Risco / Arranhão' },
  { id: 'amassado', rotulo: 'Amassado' },
  { id: 'trinca', rotulo: 'Trinca / Quebrado' },
  { id: 'pintura', rotulo: 'Pintura Descascada' },
  { id: 'falta', rotulo: 'Peça Faltante' },
  { id: 'oxidacao', rotulo: 'Ferrugem / Oxidação' },
];

export const PERTENCES_SUGERIDOS = [
  'Estepe',
  'Macaco',
  'Chave de roda',
  'Manual do proprietário',
  'Triângulo de sinalização',
  'Aparelho de som / Multimídia',
  'Documento do veículo (CRLV)',
  'Cadeirinha de bebê',
  'Chave reserva',
  'Antena',
];

export const STATUS_CORES: Record<string, { bg: string; text: string; borda?: string }> = {
  agendado: { bg: '#1E293B', text: '#94A3B8', borda: '#475569' },
  recebido: { bg: '#1E3A8A', text: '#93C5FD', borda: '#3B82F6' },
  diagnostico: { bg: '#451A03', text: '#FDBA74', borda: '#F97316' },
  orcamento: { bg: '#3730A3', text: '#C7D2FE', borda: '#6366F1' },
  aguardando_aprovacao: { bg: '#78350F', text: '#FDE68A', borda: '#F59E0B' },
  aprovado: { bg: '#064E3B', text: '#6EE7B7', borda: '#10B981' },
  em_execucao: { bg: '#0C4A6E', text: '#7DD3FC', borda: '#0284C7' },
  pronto: { bg: '#14532D', text: '#86EFAC', borda: '#22C55E' },
  entregue: { bg: '#1E293B', text: '#CBD5E1', borda: '#64748B' },
  cancelado: { bg: '#7F1D1D', text: '#FCA5A5', borda: '#EF4444' },
};

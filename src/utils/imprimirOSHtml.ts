import {
  RespostaOSCompleta,
  RespostaItemPecaOS,
  RespostaItemServicoOS,
} from '../types';
import {
  ROTULO_PAGAMENTO,
  decidirVersaoOS,
} from './whatsappHelper';

export interface ParametrosHtmlImpressaoOS {
  os: RespostaOSCompleta;
  pecas?: RespostaItemPecaOS[];
  versao?: 'orcamento' | 'os';
  nomeOficina?: string;
  cnpj?: string;
  telefone?: string;
  endereco?: string;
}

const formatarMoeda = (val: number): string => {
  return (val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const formatarData = (dataStr?: string): string => {
  if (!dataStr) return '—';
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    const hora = String(d.getHours()).padStart(2, '0');
    const minuto = String(d.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
  } catch {
    return dataStr;
  }
};

/**
 * Gera o HTML completo de impressão da OS / Orçamento,
 * reproduzindo fielmente a moldura e estilos da versão Web (imprimir-os.ts e documento-impresso.ts).
 */
export const gerarHtmlImpressaoOS = ({
  os,
  pecas = [],
  versao,
  nomeOficina = 'Auto Peça & Oficina',
  cnpj,
  telefone,
  endereco,
}: ParametrosHtmlImpressaoOS): string => {
  const versaoEfetiva = versao || decidirVersaoOS(os.status || '');
  const ehOrcamento = versaoEfetiva === 'orcamento';
  const tituloDoc = ehOrcamento
    ? `Orçamento #${os.numero}`
    : `Ordem de serviço #${os.numero}`;
  const subtituloDoc = `${os.statusRotulo || os.status} · ${os.placa}`;

  // Formatações da Ficha
  const clienteNome = os.clienteNome || 'Cliente não identificado';
  const veiculoDesc = os.veiculoDescricao || 'Veículo não informado';
  const placa = os.placa || '—';
  const kmEntrada =
    typeof os.kmEntrada === 'number'
      ? `${os.kmEntrada.toLocaleString('pt-BR')} km`
      : '—';
  const abertaEm = formatarData(os.abertaEm);
  const previsaoEntrega = formatarData(os.previsaoEntrega);
  const formaPagamentoRotulo = os.formaPagamento
    ? ROTULO_PAGAMENTO[os.formaPagamento] || os.formaPagamento
    : null;

  // Serviços
  const servicos = os.itens || [];
  let htmlServicos = '';
  if (servicos.length === 0) {
    htmlServicos = '<p class="discreto">Nenhum serviço lançado.</p>';
  } else {
    const linhasServicos = servicos
      .map(
        (it: RespostaItemServicoOS) => `
        <tr>
          <td><strong>${it.descricao}</strong></td>
          <td>${it.mecanicoNome || '—'}</td>
          <td class="num">${it.tempoPadraoHoras ? Number(it.tempoPadraoHoras).toFixed(1) + ' h' : '—'}</td>
          <td class="num">${it.garantiaDias ? it.garantiaDias + ' dias' : '90 dias'}</td>
          <td class="num">${formatarMoeda(it.valor || 0)}</td>
        </tr>`
      )
      .join('');

    htmlServicos = `
      <table>
        <thead>
          <tr>
            <th>Serviço</th>
            <th>Mecânico</th>
            <th class="num">Tempo</th>
            <th class="num">Garantia</th>
            <th class="num">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${linhasServicos}
        </tbody>
      </table>
    `;
  }

  // Peças
  const pecasValidas = pecas.filter(
    (p) => p.status !== 'cancelada' && p.status !== 'cancelado'
  );
  let htmlPecas = '';
  if (pecasValidas.length === 0) {
    htmlPecas = '<p class="discreto">Nenhuma peça lançada.</p>';
  } else {
    const linhasPecas = pecasValidas
      .map(
        (it) => `
        <tr>
          <td class="tabular">${it.codigoInterno || '—'}</td>
          <td><strong>${it.descricao}</strong></td>
          <td class="num">${it.quantidade} ${it.unidade || 'UN'}</td>
          <td class="num">${formatarMoeda(it.precoUnitario || 0)}</td>
          <td class="num"><strong>${formatarMoeda(it.total || 0)}</strong></td>
        </tr>`
      )
      .join('');

    htmlPecas = `
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Peça</th>
            <th class="num">Qtd.</th>
            <th class="num">Unitário</th>
            <th class="num">Total</th>
          </tr>
        </thead>
        <tbody>
          ${linhasPecas}
        </tbody>
      </table>
    `;
  }

  // Totais
  const totalServicos =
    os.valorServicos ??
    servicos.reduce((soma: number, it: RespostaItemServicoOS) => soma + (it.valor || 0), 0);
  const totalPecas = pecasValidas.reduce(
    (soma: number, it: RespostaItemPecaOS) => soma + (it.total || 0),
    0
  );
  const desconto = os.desconto || 0;
  const totalGeral = Math.max(0, totalServicos + totalPecas - desconto);

  let linhaDesconto = '';
  if (desconto > 0) {
    linhaDesconto = `
      <tr>
        <td>Desconto</td>
        <td class="num" style="color: #DC2626;">− ${formatarMoeda(desconto)}</td>
      </tr>
    `;
  }

  // Queixa e Diagnóstico
  let htmlQueixa = '';
  if (os.queixaCliente && os.queixaCliente.trim()) {
    htmlQueixa = `
      <h2>Queixa do cliente</h2>
      <p>${os.queixaCliente.trim()}</p>
    `;
  }

  let htmlDiagnostico = '';
  if (os.diagnostico && os.diagnostico.trim()) {
    htmlDiagnostico = `
      <h2>Diagnóstico</h2>
      <p>${os.diagnostico.trim()}</p>
    `;
  }

  // Aviso Legal / Termos
  const htmlAviso = ehOrcamento
    ? `<div class="aviso-doc">
        <strong>Orçamento.</strong> Valores sujeitos a alteração até a aprovação. Peças e
        serviços descobertos durante a execução serão orçados à parte e só executados com
        autorização do cliente.
      </div>`
    : `<div class="aviso-doc">
        <strong>Ordem de serviço.</strong> Serviços executados conforme descrito acima, com a
        garantia indicada em cada item a contar da entrega do veículo.
      </div>`;

  // Observações
  let htmlObservacoes = '';
  if (os.observacoes && os.observacoes.trim() && !ehOrcamento) {
    htmlObservacoes = `<p class="discreto"><strong>Observações:</strong> ${os.observacoes.trim()}</p>`;
  }

  // Rodapé data e hora
  const agoraStr = formatarData(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tituloDoc}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.35;
      color: #1E293B;
      background-color: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    .documento {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      padding: 4mm 2mm;
    }
    .cabecalho-doc {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .oficina strong {
      font-size: 14pt;
      font-weight: 800;
      color: #0F172A;
      display: block;
      margin-bottom: 2px;
    }
    .oficina span {
      display: block;
      font-size: 8.5pt;
      color: #64748B;
      line-height: 1.25;
    }
    .identificacao-doc {
      text-align: right;
    }
    .identificacao-doc h1 {
      margin: 0;
      font-size: 16pt;
      font-weight: 800;
      color: #0284C7;
      text-transform: uppercase;
      letter-spacing: -0.02em;
    }
    .identificacao-doc .subtitulo-doc {
      margin: 3px 0 0;
      font-size: 9pt;
      font-weight: 700;
      color: #475569;
    }

    /* Ficha de dados */
    .ficha {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px 14px;
      background-color: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
    }
    .ficha .item-ficha .rotulo {
      display: block;
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748B;
      margin-bottom: 1px;
    }
    .ficha .item-ficha strong {
      font-size: 10pt;
      color: #0F172A;
    }
    .tabular {
      font-variant-numeric: tabular-nums;
    }

    /* Títulos de seção */
    h2 {
      margin: 14px 0 6px;
      padding-bottom: 3px;
      font-size: 11pt;
      font-weight: 800;
      color: #0F172A;
      border-bottom: 1px solid #CBD5E1;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    p {
      margin: 4px 0;
      font-size: 9.5pt;
      color: #334155;
    }
    .discreto {
      color: #64748B;
      font-size: 9pt;
      font-style: italic;
    }

    /* Tabelas */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 4px;
      margin-bottom: 12px;
    }
    th, td {
      padding: 5px 6px;
      text-align: left;
      vertical-align: middle;
      border-bottom: 1px solid #E2E8F0;
    }
    th {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      background-color: #F1F5F9;
      border-bottom: 1.5px solid #CBD5E1;
    }
    td.num, th.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* Totais */
    .secao-totais {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      margin-bottom: 14px;
    }
    .tabela-totais {
      width: 260px;
      border-collapse: collapse;
      margin: 0;
    }
    .tabela-totais td {
      padding: 4px 8px;
      font-size: 9.5pt;
      border-bottom: 1px solid #E2E8F0;
    }
    .tabela-totais tfoot td {
      font-size: 11.5pt;
      font-weight: 800;
      color: #0284C7;
      border-top: 2px solid #0F172A;
      border-bottom: none;
      padding-top: 6px;
    }

    /* Aviso e Termos */
    .aviso-doc {
      margin: 12px 0;
      padding: 8px 12px;
      background-color: #FFFBEB;
      border: 1px solid #FDE68A;
      border-left: 4px solid #D97706;
      border-radius: 4px;
      font-size: 8.5pt;
      color: #78350F;
      line-height: 1.35;
    }

    /* Assinaturas */
    .assinatura-doc {
      margin-top: 32px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .assinatura-box {
      border-top: 1px solid #0F172A;
      padding-top: 5px;
      text-align: center;
      font-size: 8.5pt;
      color: #334155;
      font-weight: 600;
    }

    /* Rodapé */
    .rodape-doc {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #E2E8F0;
      text-align: center;
      font-size: 7.5pt;
      color: #94A3B8;
    }
  </style>
</head>
<body>
  <div class="documento">
    <!-- Cabeçalho -->
    <header class="cabecalho-doc">
      <div class="oficina">
        <strong>${nomeOficina}</strong>
        ${cnpj ? `<span>CNPJ ${cnpj}</span>` : ''}
        ${endereco ? `<span>${endereco}</span>` : ''}
        ${telefone ? `<span>Tel. ${telefone}</span>` : ''}
      </div>
      <div class="identificacao-doc">
        <h1>${ehOrcamento ? 'ORÇAMENTO' : 'ORDEM DE SERVIÇO'}</h1>
        <div class="subtitulo-doc">${subtituloDoc}</div>
      </div>
    </header>

    <!-- Ficha -->
    <section class="ficha">
      <div class="item-ficha">
        <span class="rotulo">Cliente</span>
        <strong>${clienteNome}</strong>
      </div>
      <div class="item-ficha">
        <span class="rotulo">Veículo</span>
        <strong><span class="tabular">${placa}</span> · ${veiculoDesc}</strong>
      </div>
      <div class="item-ficha">
        <span class="rotulo">Quilometragem</span>
        <strong class="tabular">${kmEntrada}</strong>
      </div>
      <div class="item-ficha">
        <span class="rotulo">Aberta em</span>
        <span>${abertaEm}</span>
      </div>
      <div class="item-ficha">
        <span class="rotulo">Previsão de Entrega</span>
        <span>${previsaoEntrega}</span>
      </div>
      ${
        !ehOrcamento && formaPagamentoRotulo
          ? `<div class="item-ficha">
              <span class="rotulo">Pagamento</span>
              <strong>${formaPagamentoRotulo}</strong>
            </div>`
          : `<div class="item-ficha">
              <span class="rotulo">Status</span>
              <strong>${os.statusRotulo || os.status}</strong>
            </div>`
      }
    </section>

    <!-- Queixa e Diagnóstico -->
    ${htmlQueixa}
    ${htmlDiagnostico}

    <!-- Serviços -->
    <h2>Serviços</h2>
    ${htmlServicos}

    <!-- Peças -->
    <h2>Peças e Materiais</h2>
    ${htmlPecas}

    <!-- Totais -->
    <div class="secao-totais">
      <table class="tabela-totais">
        <tbody>
          <tr>
            <td>Serviços (Mão de Obra)</td>
            <td class="num">${formatarMoeda(totalServicos)}</td>
          </tr>
          <tr>
            <td>Peças e Materiais</td>
            <td class="num">${formatarMoeda(totalPecas)}</td>
          </tr>
          ${linhaDesconto}
        </tbody>
        <tfoot>
          <tr>
            <td>Total Geral</td>
            <td class="num">${formatarMoeda(totalGeral)}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Aviso Legal -->
    ${htmlAviso}

    <!-- Observações -->
    ${htmlObservacoes}

    <!-- Linhas de Assinatura -->
    <div class="assinatura-doc">
      <div class="assinatura-box">Assinatura do Cliente</div>
      <div class="assinatura-box">Responsável pela Oficina</div>
    </div>

    <!-- Rodapé -->
    <footer class="rodape-doc">
      Documento gerado em ${agoraStr} · Sistema AutoF Gestão
    </footer>
  </div>
</body>
</html>`;
};

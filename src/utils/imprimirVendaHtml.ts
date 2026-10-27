import { ComprovanteVenda } from '../types';

export const ROTULO_FORMA_PAGAMENTO_VENDA: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto Bancário',
  crediario: 'Crediário / A Prazo',
  ted: 'Transferência Bancária (TED/DOC)',
};

export const rotuloFormaPagamentoVenda = (forma?: string | null): string => {
  if (!forma) return 'Não informado';
  return ROTULO_FORMA_PAGAMENTO_VENDA[forma] || forma.toUpperCase();
};

export const formatarMoeda = (val: number = 0): string =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface GerarHtmlVendaParams {
  comprovante: ComprovanteVenda;
  nomeOficina?: string;
  telefoneOficina?: string;
  cnpj?: string;
  endereco?: string;
  formato?: 'termico' | 'a4';
}

/**
 * Gera o documento HTML térmico (80mm) ou folha A4 para impressão do comprovante não fiscal
 * ou orçamento de peças, conforme a tela do sistema web (AF-0174).
 */
export const gerarHtmlComprovanteVenda = ({
  comprovante,
  nomeOficina = 'AutoF - Gestão de Peças e Oficinas',
  telefoneOficina = '',
  cnpj = '',
  endereco = '',
  formato = 'termico',
}: GerarHtmlVendaParams): string => {
  const ehOrcamento = comprovante.status === 'orcamento';
  const dataFormatada = (() => {
    try {
      const d = new Date(comprovante.criadaEm);
      return !isNaN(d.getTime())
        ? `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : comprovante.criadaEm;
    } catch {
      return comprovante.criadaEm;
    }
  })();

  const validadeFormatada = comprovante.validaAte
    ? (() => {
        try {
          const d = new Date(comprovante.validaAte);
          return !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : comprovante.validaAte;
        } catch {
          return comprovante.validaAte;
        }
      })()
    : null;

  const itensHtml = (comprovante.itens || [])
    .map((item, idx) => {
      const marca = item.marca ? ` · ${item.marca}` : '';
      const cod = item.codigo ? `[${item.codigo}] ` : '';
      return `
      <tr style="border-bottom: 1px dashed #ddd;">
        <td style="padding: 6px 2px;">
          <div style="font-weight: 600; font-size: 13px;">${idx + 1}. ${cod}${item.descricao}</div>
          <div style="font-size: 11px; color: #555;">${marca}</div>
        </td>
        <td style="text-align: center; padding: 6px 2px; font-size: 12px;">${item.quantidade} UN</td>
        <td style="text-align: right; padding: 6px 2px; font-size: 12px;">${formatarMoeda(item.precoUnitario)}</td>
        <td style="text-align: right; padding: 6px 2px; font-size: 13px; font-weight: 700;">${formatarMoeda(item.total)}</td>
      </tr>
    `;
    })
    .join('');

  const larguraEstilo =
    formato === 'termico'
      ? 'max-width: 320px; margin: 0 auto; padding: 12px 8px; font-family: monospace, sans-serif;'
      : 'max-width: 780px; margin: 0 auto; padding: 24px; font-family: sans-serif;';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${ehOrcamento ? 'Orçamento' : 'Comprovante'} #${comprovante.numero}</title>
      <style>
        body {
          margin: 0;
          padding: 10px;
          background-color: #ffffff;
          color: #111827;
        }
        .container {
          ${larguraEstilo}
        }
        .header {
          text-align: center;
          margin-bottom: 12px;
        }
        .header h1 {
          font-size: 16px;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          font-weight: 800;
        }
        .header p {
          font-size: 11px;
          margin: 2px 0;
          color: #4b5563;
        }
        .divider {
          border-top: 1px dashed #6b7280;
          margin: 8px 0;
        }
        .faixa-aviso {
          background-color: #f3f4f6;
          border: 1px solid #d1d5db;
          padding: 6px;
          text-align: center;
          border-radius: 4px;
          margin: 6px 0;
          font-size: 11px;
          font-weight: 700;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin: 3px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        th {
          font-size: 11px;
          border-bottom: 1px solid #111;
          padding: 4px 2px;
          text-transform: uppercase;
        }
        .totais {
          margin-top: 8px;
          font-size: 13px;
        }
        .total-destaque {
          font-size: 16px;
          font-weight: 900;
          color: #0f172a;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid #111;
        }
        .termo-cdc {
          margin-top: 14px;
          font-size: 10px;
          color: #4b5563;
          text-align: justify;
          line-height: 1.3;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${nomeOficina}</h1>
          ${cnpj ? `<p>CNPJ: ${cnpj}</p>` : ''}
          ${endereco ? `<p>${endereco}</p>` : ''}
          ${telefoneOficina ? `<p>Contato: ${telefoneOficina}</p>` : ''}
        </div>

        <div class="divider"></div>

        <div class="faixa-aviso">
          ${
            ehOrcamento
              ? `*** ORÇAMENTO DE PEÇAS Nº #${comprovante.numero} ***<br>
                 <span style="font-weight: normal;">${validadeFormatada ? `Válido até: ${validadeFormatada}` : 'Validade de 10 dias'} · Sujeito a confirmação</span>`
              : `*** COMPROVANTE NÃO FISCAL ***<br>
                 <span style="font-weight: normal;">DOCUMENTO AUXILIAR DE VENDA · NÃO É NOTA FISCAL</span>`
          }
        </div>

        <div class="divider"></div>

        <div class="info-row">
          <span><strong>${ehOrcamento ? 'ORÇAMENTO:' : 'VENDA:'}</strong> #${comprovante.numero}</span>
          <span><strong>DATA:</strong> ${dataFormatada}</span>
        </div>
        <div class="info-row">
          <span><strong>VENDEDOR:</strong> ${comprovante.vendedorNome || 'Balcão'}</span>
          <span><strong>CANAL:</strong> Loja Física</span>
        </div>

        <div class="divider"></div>

        <div class="info-row">
          <span><strong>CLIENTE:</strong> ${comprovante.clienteNome || 'Consumidor Final'}</span>
        </div>
        ${
          comprovante.clienteDocumento
            ? `<div class="info-row"><span><strong>CPF/CNPJ:</strong> ${comprovante.clienteDocumento}</span></div>`
            : ''
        }
        ${
          comprovante.clienteTelefone
            ? `<div class="info-row"><span><strong>FONE:</strong> ${comprovante.clienteTelefone}</span></div>`
            : ''
        }

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th style="text-align: left;">DESCRIÇÃO</th>
              <th style="text-align: center;">QTD</th>
              <th style="text-align: right;">UNIT</th>
              <th style="text-align: right;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itensHtml}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="totais">
          <div class="info-row">
            <span>Qtd de Itens:</span>
            <span><strong>${comprovante.itens?.length || 0}</strong></span>
          </div>
          <div class="info-row">
            <span>Subtotal Bruto:</span>
            <span>${formatarMoeda(comprovante.subtotal || comprovante.total + (comprovante.desconto || 0))}</span>
          </div>
          ${
            comprovante.desconto && comprovante.desconto > 0
              ? `<div class="info-row" style="color: #059669;">
                  <span>Desconto:</span>
                  <span>- ${formatarMoeda(comprovante.desconto)}</span>
                </div>`
              : ''
          }
          <div class="info-row total-destaque">
            <span>TOTAL LÍQUIDO:</span>
            <span>${formatarMoeda(comprovante.total)}</span>
          </div>
        </div>

        ${
          !ehOrcamento && comprovante.formaPagamento
            ? `
          <div class="divider"></div>
          <div class="info-row">
            <span><strong>FORMA PAGTO:</strong> ${rotuloFormaPagamentoVenda(comprovante.formaPagamento)}</span>
            ${comprovante.parcelas && comprovante.parcelas > 1 ? `<span>(${comprovante.parcelas}x)</span>` : ''}
          </div>
          ${comprovante.autorizacaoCartao ? `<div class="info-row"><span>NSU / Aut: ${comprovante.autorizacaoCartao}</span></div>` : ''}
        `
            : ''
        }

        ${
          comprovante.observacoes
            ? `
          <div class="divider"></div>
          <div style="font-size: 11px; margin: 4px 0;">
            <strong>Observações:</strong><br>${comprovante.observacoes}
          </div>
        `
            : ''
        }

        <div class="divider"></div>

        <div class="termo-cdc">
          ${
            ehOrcamento
              ? 'Orçamento gerado para conferência de peças e valores. A garantia legal de 90 dias entra em vigor a partir da emissão da venda final e entrega do produto (Art. 26 do CDC).'
              : 'Garantia legal de 90 (noventa) dias contra defeitos de fabricação a contar da data de entrega, conforme Artigo 26, Inciso II do Código de Defesa do Consumidor. Conserve este comprovante.'
          }
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Gera mensagem formatada para WhatsApp de Venda ou Orçamento de Peças.
 */
export const gerarTextoVendaParaWhatsApp = (
  comprovante: ComprovanteVenda,
  nomeOficina = 'AutoF Gestão'
): string => {
  const ehOrcamento = comprovante.status === 'orcamento';
  const clienteNome = comprovante.clienteNome?.trim() || 'Cliente';
  const numero = comprovante.numero;

  const itens = (comprovante.itens || []).map((it, idx) => {
    const cod = it.codigo ? `[${it.codigo}] ` : '';
    const qtd = `${it.quantidade} UN`;
    const unit = formatarMoeda(it.precoUnitario);
    const tot = formatarMoeda(it.total);
    return `  ${idx + 1}. *${cod}${it.descricao}*\n     Qtd: ${qtd} x ${unit} = *${tot}*`;
  });

  const subtotal = comprovante.subtotal || comprovante.total + (comprovante.desconto || 0);
  const desconto = comprovante.desconto || 0;
  const total = comprovante.total;

  let financeiro = `💰 *VALORES:*
• Subtotal: ${formatarMoeda(subtotal)}`;
  if (desconto > 0) {
    financeiro += `\n• Desconto: - ${formatarMoeda(desconto)}`;
  }
  financeiro += `\n⭐️ *TOTAL: ${formatarMoeda(total)}*`;

  const pagamento =
    !ehOrcamento && comprovante.formaPagamento
      ? `\n💳 *Pagamento:* ${rotuloFormaPagamentoVenda(comprovante.formaPagamento)}${
          comprovante.parcelas && comprovante.parcelas > 1 ? ` (${comprovante.parcelas}x)` : ''
        }`
      : '';

  const aviso = ehOrcamento
    ? '⚠️ *Orçamento de Balcão:* Valores e disponibilidade sujeitos a confirmação no momento da compra.'
    : '✅ *Garantia:* Peças com 90 dias de garantia legal conforme CDC contra defeitos de fabricação.';

  return `🏢 *${nomeOficina}*
📦 *${ehOrcamento ? 'ORÇAMENTO DE PEÇAS' : 'VENDA DE PEÇAS'} #${numero}*
────────────────────────
👤 *Cliente:* ${clienteNome}
📅 *Data:* ${new Date(comprovante.criadaEm).toLocaleDateString('pt-BR')}${pagamento}
────────────────────────

🔩 *ITENS (${itens.length}):*
${itens.join('\n')}

${financeiro}

────────────────────────
${aviso}

Agradecemos a preferência! 🤝`.trim();
};

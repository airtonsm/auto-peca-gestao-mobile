import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CORES } from '../constants';
import { RespostaCliente, RespostaVeiculo, RespostaServico } from '../types';
import { ModalCadastroCliente } from './ModalCadastroCliente';
import { ModalCadastroVeiculo } from './ModalCadastroVeiculo';
import { ModalCadastroServico } from './ModalCadastroServico';

interface ModalHubCadastrosProps {
  visivel: boolean;
  aoFechar: () => void;
  aoClienteCriado?: (cliente: RespostaCliente) => void;
  aoVeiculoCriado?: (veiculo: RespostaVeiculo) => void;
  aoServicoCriado?: (servico: RespostaServico) => void;
}

export const ModalHubCadastros: React.FC<ModalHubCadastrosProps> = ({
  visivel,
  aoFechar,
  aoClienteCriado,
  aoVeiculoCriado,
  aoServicoCriado,
}) => {
  const insets = useSafeAreaInsets();

  const [modalClienteVisivel, setModalClienteVisivel] = useState(false);
  const [modalVeiculoVisivel, setModalVeiculoVisivel] = useState(false);
  const [modalServicoVisivel, setModalServicoVisivel] = useState(false);

  const abrirCadastroCliente = () => {
    setModalClienteVisivel(true);
  };

  const abrirCadastroVeiculo = () => {
    setModalVeiculoVisivel(true);
  };

  const abrirCadastroServico = () => {
    setModalServicoVisivel(true);
  };

  const handleClienteSalvo = (cliente: RespostaCliente) => {
    if (aoClienteCriado) {
      aoClienteCriado(cliente);
    }
    Alert.alert('Cliente Cadastrado!', `${cliente.nome} foi cadastrado com sucesso.`);
    aoFechar();
  };

  const handleVeiculoSalvo = (veiculo: RespostaVeiculo) => {
    if (aoVeiculoCriado) {
      aoVeiculoCriado(veiculo);
    }
    Alert.alert('Veículo Cadastrado!', `Veículo placa ${veiculo.placa} (${veiculo.descricao}) cadastrado com sucesso.`);
    aoFechar();
  };

  const handleServicoSalvo = (servico: RespostaServico) => {
    if (aoServicoCriado) {
      aoServicoCriado(servico);
    }
    Alert.alert('Serviço Cadastrado!', `"${servico.nome}" cadastrado com sucesso.`);
    aoFechar();
  };

  return (
    <>
      <Modal
        visible={visivel}
        animationType="fade"
        transparent
        onRequestClose={aoFechar}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={aoFechar}
        >
          <TouchableOpacity
            style={[styles.conteudoModal, { paddingBottom: Math.max(insets.bottom, 24) }]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Barra de arraste/indicador visual */}
            <View style={styles.arrasteBarra} />

            {/* Cabeçalho */}
            <View style={styles.cabecalho}>
              <View style={styles.cabecalhoTextos}>
                <View style={styles.tituloLinha}>
                  <Ionicons name="flash" size={20} color="#F59E0B" />
                  <Text style={styles.titulo}>Cadastros Rápidos</Text>
                </View>
                <Text style={styles.subtitulo}>
                  Agilidade no pátio e recepção em menos de 30 segundos
                </Text>
              </View>

              <TouchableOpacity
                onPress={aoFechar}
                style={styles.botaoFechar}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={CORES.textoSecundario} />
              </TouchableOpacity>
            </View>

            {/* Cards de Ação */}
            <View style={styles.cardsContainer}>
              {/* Card 1: Cliente */}
              <TouchableOpacity
                style={styles.cardAcao}
                activeOpacity={0.8}
                onPress={abrirCadastroCliente}
              >
                <View style={[styles.cardIconeBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Ionicons name="person-add" size={26} color="#38BDF8" />
                </View>

                <View style={styles.cardTextos}>
                  <View style={styles.cardTituloLinha}>
                    <Text style={styles.cardTitulo}>Novo Cliente</Text>
                    <View style={styles.tagRapido}>
                      <Text style={styles.tagRapidoTexto}>PF / PJ</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDescricao}>
                    Cadastro ágil com WhatsApp para envio direto de laudos e notificações da OS.
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={CORES.textoMudo} />
              </TouchableOpacity>

              {/* Card 2: Veículo */}
              <TouchableOpacity
                style={styles.cardAcao}
                activeOpacity={0.8}
                onPress={abrirCadastroVeiculo}
              >
                <View style={[styles.cardIconeBox, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                  <Ionicons name="car-sport" size={26} color="#22C55E" />
                </View>

                <View style={styles.cardTextos}>
                  <View style={styles.cardTituloLinha}>
                    <Text style={styles.cardTitulo}>Novo Veículo</Text>
                    <View style={[styles.tagRapido, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
                      <Text style={[styles.tagRapidoTexto, { color: '#22C55E' }]}>Mercosul</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDescricao}>
                    Placa padrão Mercosul, marca, modelo, ano, KM e proprietário do carro.
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={CORES.textoMudo} />
              </TouchableOpacity>

              {/* Card 3: Serviço */}
              <TouchableOpacity
                style={styles.cardAcao}
                activeOpacity={0.8}
                onPress={abrirCadastroServico}
              >
                <View style={[styles.cardIconeBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Ionicons name="build" size={26} color="#F59E0B" />
                </View>

                <View style={styles.cardTextos}>
                  <View style={styles.cardTituloLinha}>
                    <Text style={styles.cardTitulo}>Novo Serviço</Text>
                    <View style={[styles.tagRapido, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                      <Text style={[styles.tagRapidoTexto, { color: '#F59E0B' }]}>Mão de Obra</Text>
                    </View>
                  </View>
                  <Text style={styles.cardDescricao}>
                    Tabela de serviços da oficina, valor em R$, tempo padrão e categoria.
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color={CORES.textoMudo} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modais Filhos */}
      <ModalCadastroCliente
        visivel={modalClienteVisivel}
        aoFechar={() => setModalClienteVisivel(false)}
        aoSalvar={handleClienteSalvo}
      />

      <ModalCadastroVeiculo
        visivel={modalVeiculoVisivel}
        aoFechar={() => setModalVeiculoVisivel(false)}
        aoSalvar={handleVeiculoSalvo}
      />

      <ModalCadastroServico
        visivel={modalServicoVisivel}
        aoFechar={() => setModalServicoVisivel(false)}
        aoSalvar={handleServicoSalvo}
      />
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  conteudoModal: {
    backgroundColor: CORES.fundo,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
  },
  arrasteBarra: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: CORES.superficieElevada,
    alignSelf: 'center',
    marginBottom: 12,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: CORES.bordaSuave,
  },
  cabecalhoTextos: {
    flex: 1,
    marginRight: 10,
  },
  tituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titulo: {
    fontSize: 20,
    fontWeight: '800',
    color: CORES.texto,
  },
  subtitulo: {
    fontSize: 12,
    color: CORES.textoSecundario,
    marginTop: 2,
  },
  botaoFechar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: CORES.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 12,
  },
  cardAcao: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CORES.superficie,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: CORES.bordaSuave,
    gap: 14,
  },
  cardIconeBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextos: {
    flex: 1,
  },
  cardTituloLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: CORES.texto,
  },
  tagRapido: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagRapidoTexto: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  cardDescricao: {
    fontSize: 12,
    color: CORES.textoSecundario,
    lineHeight: 16,
  },
});

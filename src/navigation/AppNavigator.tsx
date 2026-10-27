import React, { useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { AutoFLogo } from '../components/AutoFLogo';
import { ModalTrocarOficina } from '../components/ModalTrocarOficina';

// Telas
import { LoginScreen } from '../screens/LoginScreen';
import { PatioScreen } from '../screens/PatioScreen';
import { VendasScreen } from '../screens/VendasScreen';
import { EstoqueScreen } from '../screens/EstoqueScreen';
import { ChecklistScreen } from '../screens/ChecklistScreen';
import { PerfilScreen } from '../screens/PerfilScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

interface HeaderOficinaComLogoProps {
  aoTocar?: () => void;
}

const HeaderOficinaComLogo: React.FC<HeaderOficinaComLogoProps> = ({ aoTocar }) => {
  const { oficinaAtiva, usuario } = useAuth();
  const nomeOficina = oficinaAtiva?.nome || usuario?.empresa || 'Minha Oficina';

  return (
    <TouchableOpacity
      style={styles.headerOficinaContainer}
      onPress={aoTocar}
      activeOpacity={aoTocar ? 0.7 : 1}
    >
      <AutoFLogo tamanho="mini" mostrarTexto={false} orientacao="horizontal" />
      <View style={styles.headerOficinaTextoWrapper}>
        <Text style={styles.headerOficinaTexto} numberOfLines={1} ellipsizeMode="tail">
          {nomeOficina}
        </Text>
        {aoTocar && (
          <Ionicons
            name="chevron-down"
            size={14}
            color={CORES.primariaClara}
            style={styles.headerOficinaChevron}
          />
        )}
      </View>
    </TouchableOpacity>
  );
};

const AbasPrincipais = () => {
  const { logout } = useAuth();
  const [modalTrocarOficinaVisivel, setModalTrocarOficinaVisivel] = useState(false);

  const handleConfirmarLogout = () => {
    Alert.alert(
      'Sair da Conta',
      'Deseja realmente encerrar a sessão deste dispositivo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair da Conta',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerTitleAlign: 'left',
          headerStyle: {
            backgroundColor: CORES.superficie,
          },
          headerTitleStyle: {
            color: CORES.texto,
            fontWeight: '800',
            fontSize: 18,
          },
          headerTintColor: CORES.texto,
          headerRight: () => (
            <View style={styles.headerAcoesContainer}>
              <TouchableOpacity
                style={styles.botaoHeaderOficina}
                onPress={() => setModalTrocarOficinaVisivel(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
                accessibilityLabel="Trocar Oficina"
              >
                <Ionicons name="business-outline" size={18} color={CORES.primariaClara} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoHeaderSair}
                onPress={handleConfirmarLogout}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                accessibilityLabel="Encerrar Sessão"
              >
                <Ionicons name="log-out-outline" size={20} color={CORES.perigoTexto} />
              </TouchableOpacity>
            </View>
          ),
          tabBarStyle: {
            backgroundColor: CORES.superficie,
            borderTopColor: CORES.bordaSuave,
            height: 60,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarActiveTintColor: CORES.primariaClara,
          tabBarInactiveTintColor: CORES.textoMudo,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '700',
          },
        }}
      >
        <Tab.Screen
          name="Patio"
          component={PatioScreen}
          options={{
            headerTitle: () => (
              <HeaderOficinaComLogo aoTocar={() => setModalTrocarOficinaVisivel(true)} />
            ),
            tabBarLabel: 'Pátio (OS)',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="car-sport" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Vendas"
          component={VendasScreen}
          options={{
            title: 'Vendas de Peças',
            tabBarLabel: 'Vendas',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Estoque"
          component={EstoqueScreen}
          options={{
            title: 'Consulta de Estoque',
            tabBarLabel: 'Consultar Estoque',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Perfil"
          component={PerfilScreen}
          options={{
            title: 'Minha Oficina',
            tabBarLabel: 'Oficina',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="business" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>

      {/* Modal Rápido de Troca de Oficina e Logout */}
      <ModalTrocarOficina
        visivel={modalTrocarOficinaVisivel}
        aoFechar={() => setModalTrocarOficinaVisivel(false)}
      />
    </>
  );
};

export const AppNavigator: React.FC = () => {
  const { estaAutenticado, carregando } = useAuth();

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <AutoFLogo tamanho="grande" mostrarSubtitulo={false} orientacao="vertical" />
        <ActivityIndicator size="large" color={CORES.primariaClara} style={styles.loadingSpinner} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: CORES.fundo,
          },
        }}
      >
        {!estaAutenticado ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={AbasPrincipais} />
            <Stack.Screen
              name="Checklist"
              component={ChecklistScreen}
              options={{
                presentation: 'fullScreenModal',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: CORES.fundo,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginTop: 28,
  },
  headerOficinaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  headerOficinaTextoWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  headerOficinaTexto: {
    color: CORES.texto,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    maxWidth: 180,
  },
  headerOficinaChevron: {
    marginLeft: 4,
  },
  headerAcoesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    gap: 8,
  },
  botaoHeaderOficina: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.3)',
  },
  botaoHeaderSair: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
});

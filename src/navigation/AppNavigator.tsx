import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { CORES } from '../constants';
import { AutoFLogo } from '../components/AutoFLogo';

// Telas
import { LoginScreen } from '../screens/LoginScreen';
import { PatioScreen } from '../screens/PatioScreen';
import { EstoqueScreen } from '../screens/EstoqueScreen';
import { ChecklistScreen } from '../screens/ChecklistScreen';
import { PerfilScreen } from '../screens/PerfilScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const HeaderOficinaComLogo: React.FC = () => {
  const { oficinaAtiva, usuario } = useAuth();
  const nomeOficina = oficinaAtiva?.nome || usuario?.empresa || 'Minha Oficina';

  return (
    <View style={styles.headerOficinaContainer}>
      <AutoFLogo tamanho="mini" mostrarTexto={false} orientacao="horizontal" />
      <Text style={styles.headerOficinaTexto} numberOfLines={1} ellipsizeMode="tail">
        {nomeOficina}
      </Text>
    </View>
  );
};

const AbasPrincipais = () => {
  return (
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
          headerTitle: () => <HeaderOficinaComLogo />,
          tabBarLabel: 'Pátio (OS)',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="car-sport" size={size} color={color} />
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
    gap: 10,
    paddingRight: 16,
  },
  headerOficinaTexto: {
    color: CORES.texto,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
});

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from './auth-context';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ChatListScreen } from './screens/ChatListScreen';
import { NewChatScreen } from './screens/NewChatScreen';
import { ConversationScreen } from './screens/ConversationScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { QuestListScreen } from './screens/QuestListScreen';
import { QuestDetailScreen } from './screens/QuestDetailScreen';
import { HideAndSeekListScreen } from './screens/HideAndSeekListScreen';
import { HideAndSeekDetailScreen } from './screens/HideAndSeekDetailScreen';
import { LprScanScreen } from './screens/LprScanScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { navigationTheme } from './theme';
import type { RoomType } from './rocketchat/types';

interface QuestCheckpointParam {
  id: string;
  title: string;
  description: string | null;
  points: number;
  order: number;
  completed: boolean;
}

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ChatList: undefined;
  NewChat: undefined;
  Conversation: { roomId: string; roomType: RoomType; title: string; peerUserId?: string };
  Profile: undefined;
  Quests: undefined;
  QuestDetail: { questId: string; title: string; checkpoints: QuestCheckpointParam[] };
  HideAndSeek: undefined;
  HideAndSeekDetail: { roundId: string; title: string; points: number; iAmHider: boolean; found: boolean };
  LprScan: undefined;
  Leaderboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) return null;

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator>
        {token ? (
          <>
            <Stack.Screen name="ChatList" component={ChatListScreen} options={{ headerShown: false }} />
            <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: '💬 Новый чат' }} />
            <Stack.Screen name="Conversation" component={ConversationScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: '👤 Профиль' }} />
            <Stack.Screen name="Quests" component={QuestListScreen} options={{ title: '🗺️ Квесты' }} />
            <Stack.Screen
              name="QuestDetail"
              component={QuestDetailScreen}
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen name="HideAndSeek" component={HideAndSeekListScreen} options={{ title: '🙈 Прятки' }} />
            <Stack.Screen
              name="HideAndSeekDetail"
              component={HideAndSeekDetailScreen}
              options={({ route }) => ({ title: route.params.title })}
            />
            <Stack.Screen name="LprScan" component={LprScanScreen} options={{ title: 'Номер авто' }} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: '🏆 Лидерборд' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

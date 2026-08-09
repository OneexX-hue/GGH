import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useAuth } from '../auth-context';

// Заглушка после логина — чат/мероприятия появятся, когда стабилизируется
// chat-bridge (backend) и будет добавлена защита медиа (react-native-capture-protection,
// требует Expo Dev Client — уже настроен в package.json/app.json).
export function HomeScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Добро пожаловать в CarClub</Text>
      <Pressable style={styles.button} onPress={() => logout()}>
        <Text style={styles.buttonText}>Выйти</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f1115', gap: 16 },
  text: { color: '#fff', fontSize: 18 },
  button: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 12, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontWeight: '600' },
});

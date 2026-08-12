import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TextInput, Button, HelperText } from 'react-native-paper';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth-context';
import { ApiError } from '../api';
import type { RootStackParamList } from '../navigation';
import { Icon } from '../components/Icon';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password, totpCode || undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.brandMark}>
        <Icon name="shield-lock" size={34} color={colors.primary} />
      </View>
      <Text variant="headlineMedium" style={styles.title}>
        CarClub
      </Text>
      <TextInput
        mode="outlined"
        label="Email или телефон"
        autoCapitalize="none"
        value={identifier}
        onChangeText={setIdentifier}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      <TextInput
        mode="outlined"
        label="🔐 Код 2FA (если включена)"
        keyboardType="number-pad"
        maxLength={6}
        value={totpCode}
        onChangeText={setTotpCode}
        style={styles.input}
      />
      {error && <HelperText type="error">⚠️ {error}</HelperText>}
      <Button
        mode="contained"
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
        style={styles.button}
        icon={({ size, color }) => <Icon name="lock" size={size * 0.75} color={color} />}
      >
        {submitting ? 'Входим…' : 'Войти'}
      </Button>
      <Button mode="text" onPress={() => navigation.navigate('Register')} style={styles.link}>
        Есть инвайт-код? Зарегистрироваться
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#050506' },
  brandMark: { alignItems: 'center', marginBottom: 6 },
  title: { textAlign: 'center', marginBottom: 24, fontWeight: '700' },
  input: { marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 8 },
  link: { marginTop: 8 },
});

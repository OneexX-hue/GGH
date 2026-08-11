import { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { Text, TextInput, Button, Switch, HelperText, Chip, Divider } from 'react-native-paper';
import { useAuth } from '../auth-context';
import { apiFetch, ApiError } from '../api';

interface Me {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  status: string;
  pointsTotal: number;
  roles: { role: { id: string; name: string } }[];
}

interface Vehicle {
  id: string;
  make: string;
  model: string;
  plateNumber: string;
  isPlatePublic: boolean;
}

export function ProfileScreen() {
  const { token, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [isPlatePublic, setIsPlatePublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadMe() {
    if (!token) return;
    apiFetch<Me>('/users/me', { token })
      .then((result) => {
        setMe(result);
        setDisplayName(result.displayName);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить профиль'));
  }

  function loadVehicles() {
    if (!token) return;
    apiFetch<Vehicle[]>('/users/me/vehicles', { token })
      .then(setVehicles)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Не удалось загрузить автомобили'));
  }

  useEffect(() => {
    loadMe();
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSaveProfile() {
    if (!token || !displayName) return;
    setError(null);
    setSaving(true);
    try {
      const result = await apiFetch<Me>('/users/me', { method: 'PATCH', token, body: { displayName } });
      setMe(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  }

  async function onAddVehicle() {
    if (!token || !make || !model || !plateNumber) return;
    setError(null);
    try {
      await apiFetch('/users/me/vehicles', {
        method: 'POST',
        token,
        body: { make, model, plateNumber, isPlatePublic },
      });
      setMake('');
      setModel('');
      setPlateNumber('');
      setIsPlatePublic(false);
      loadVehicles();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось добавить автомобиль');
    }
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={vehicles}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          {error && <HelperText type="error">⚠️ {error}</HelperText>}

          <Text variant="titleLarge" style={styles.sectionTitle}>
            👤 Профиль
          </Text>
          {me && (
            <View style={styles.chipRow}>
              <Chip icon="star-circle-outline" compact>
                🏆 {me.pointsTotal} баллов
              </Chip>
              <Chip icon="account-check-outline" compact>
                {me.status}
              </Chip>
              {me.roles.length > 0 && (
                <Chip icon="shield-star-outline" compact>
                  {me.roles.map((r) => r.role.name).join(', ')}
                </Chip>
              )}
            </View>
          )}
          <TextInput mode="outlined" label="Имя" value={displayName} onChangeText={setDisplayName} style={styles.input} />
          <Button mode="contained" onPress={onSaveProfile} loading={saving} disabled={saving} style={styles.button}>
            💾 Сохранить
          </Button>

          <Divider style={styles.divider} />

          <Text variant="titleLarge" style={styles.sectionTitle}>
            🚗 Мои автомобили
          </Text>
          <TextInput mode="outlined" label="Марка" value={make} onChangeText={setMake} style={styles.input} />
          <TextInput mode="outlined" label="Модель" value={model} onChangeText={setModel} style={styles.input} />
          <TextInput
            mode="outlined"
            label="Гос. номер"
            autoCapitalize="characters"
            value={plateNumber}
            onChangeText={setPlateNumber}
            style={styles.input}
          />
          <View style={styles.row}>
            <Text variant="bodyMedium" style={styles.switchLabel}>
              Показывать номер другим участникам
            </Text>
            <Switch value={isPlatePublic} onValueChange={setIsPlatePublic} />
          </View>
          <Button mode="outlined" onPress={onAddVehicle} style={styles.button}>
            ➕ Добавить автомобиль
          </Button>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.vehicleRow}>
          <Text style={styles.vehicleText}>
            🚘 {item.make} {item.model} · {item.plateNumber}
            {item.isPlatePublic ? '' : ' (номер скрыт)'}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.dim}>Пока нет добавленных автомобилей</Text>}
      ListFooterComponent={
        <Button mode="text" textColor="#d97a72" onPress={() => logout()} style={styles.logoutButton}>
          🚪 Выйти
        </Button>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0b' },
  content: { padding: 24 },
  sectionTitle: { marginBottom: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  input: { marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  switchLabel: { flex: 1, marginRight: 8 },
  button: { borderRadius: 8, marginTop: 4 },
  divider: { marginVertical: 24 },
  logoutButton: { marginTop: 24, marginBottom: 24 },
  dim: { color: '#87878a', marginBottom: 4 },
  vehicleRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#222225' },
  vehicleText: { color: '#f0f0ee' },
});

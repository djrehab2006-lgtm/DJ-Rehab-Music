import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed" size={48} color="#64748B" />
          </View>
          <Text style={styles.infoTitle}>Admin Features Disabled</Text>
          <Text style={styles.infoText}>
            This app uses built-in music data. To update tracks or folders, please contact the app developer.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
                <TextInput
                  style={styles.input}
                  placeholder="Username"
                  placeholderTextColor="#64748B"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  editable={!loginLoading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#64748B"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loginLoading}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loginLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loginLoading}
              >
                {loginLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Sign In</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <Text style={styles.headerSubtitle}>Manage Collections & Tracks</Text>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Ionicons name="musical-notes" size={64} color="#10B981" />
          <Text style={styles.cardTitle}>Admin Dashboard</Text>
          <Text style={styles.cardText}>You are now logged in as admin. Management features coming soon!</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' },
  loginContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#FCD34D', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  loginTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  loginSubtitle: { fontSize: 14, color: '#94A3B8' },
  loginForm: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, marginBottom: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: '#334155' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 56, color: '#FFFFFF', fontSize: 16 },
  loginButton: { backgroundColor: '#10B981', height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#1E293B', borderRadius: 16, padding: 32, alignItems: 'center' },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  cardText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
});

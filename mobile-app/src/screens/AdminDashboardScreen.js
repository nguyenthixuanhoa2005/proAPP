import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppBottomNav } from '../components/AppChrome';

export default function AdminDashboardScreen({ onLogout, user }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = user?.fullName || 'Nguyen Van A';
  const displayEmail = user?.email || 'user@nutrichef.com';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Quan ly he thong</Text>
          <Text style={styles.subtitle}>Dang nhap voi vai tro Admin</Text>
        </View>
        <View style={styles.headerActions}>
          <View style={styles.bellWrap}>
            <Feather name="bell" size={22} color="#4b5563" />
            <View style={styles.badgeDot}>
              <Text style={styles.badgeText}>3</Text>
            </View>
          </View>

          <Pressable style={styles.avatarBubble} onPress={() => setMenuOpen((v) => !v)}>
            <Feather name="user" size={20} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      {menuOpen ? (
        <View style={styles.menuPopup}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuName}>{displayName}</Text>
            <Text style={styles.menuEmail}>{displayEmail}</Text>
          </View>

          <Pressable
            style={styles.menuRow}
            onPress={() => {
              setMenuOpen(false);
              Alert.alert('Thong bao', 'Chuc nang cai dat tai khoan se duoc noi o buoc tiep theo.');
            }}
          >
            <View style={styles.menuIconWrap}>
              <Feather name="settings" size={18} color="#6b7280" />
            </View>
            <Text style={styles.menuText}>Cai dat tai khoan</Text>
          </Pressable>

          <Pressable
            style={styles.menuRow}
            onPress={() => {
              setMenuOpen(false);
              onLogout?.();
            }}
          >
            <View style={styles.menuIconWrap}>
              <Feather name="log-out" size={18} color="#ef4444" />
            </View>
            <Text style={styles.menuTextDanger}>Dang xuat</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Admin Dashboard</Text>
        <Text style={styles.cardText}>Menu duoi da duoc chuyen sang bo tab admin.</Text>
        <Text style={styles.cardText}>Muc cuoi da doi thanh "Giao dich" nhu yeu cau.</Text>
        <Text style={styles.logoutText} onPress={onLogout}>Dang xuat</Text>
      </View>

      <AppBottomNav
        role="admin"
        activeKey="users"
        onTabPress={(tabKey) => {
          if (tabKey !== 'users') {
            Alert.alert('Thong bao', `Tab ${tabKey} se duoc noi o buoc tiep theo.`);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    justifyContent: 'space-between',
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellWrap: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDot: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fb7185',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#6b7280',
  },
  avatarBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuPopup: {
    position: 'absolute',
    top: 62,
    right: 14,
    width: 260,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
    zIndex: 20,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  menuEmail: {
    marginTop: 2,
    fontSize: 14,
    color: '#6b7280',
  },
  menuRow: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  menuIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  menuTextDanger: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '600',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  logoutText: {
    marginTop: 14,
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
});

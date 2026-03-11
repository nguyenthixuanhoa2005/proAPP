import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const NAV_ITEMS = [
  {
    key: 'home',
    label: 'Trang chủ',
    icon: { family: Feather, name: 'home' },
  },
  {
    key: 'suggest',
    label: 'Gợi ý',
    icon: { family: MaterialCommunityIcons, name: 'creation-outline' },
    featured: true,
  },
  {
    key: 'menu',
    label: 'Mâm cơm',
    icon: { family: MaterialCommunityIcons, name: 'silverware-fork-knife' },
  },
  {
    key: 'recipes',
    label: 'Công thức',
    icon: { family: Ionicons, name: 'book-outline' },
  },
  {
    key: 'profile',
    label: 'Tôi',
    icon: { family: Feather, name: 'user' },
  },
];

const NavIcon = ({ family: IconComponent, name, color, size }) => (
  <IconComponent name={name} size={size} color={color} />
);

export function AppHeader({ onLoginPress, onSignupPress }) {
  return (
    <View style={styles.headerWrap}>
      <View style={styles.headerBar}>
        <View style={styles.brandWrap}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons name="chef-hat" size={22} color="#ffffff" />
          </View>
          <Text style={styles.brandText}>NutriChef</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable onPress={onLoginPress} style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Đăng nhập</Text>
          </Pressable>
          <Pressable onPress={onSignupPress} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Đăng ký</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function AppBottomNav({ activeKey = 'suggest', onTabPress }) {
  return (
    <View style={styles.bottomNavWrap}>
      <View style={styles.bottomNavBar}>
        {NAV_ITEMS.map((item) => {
          const active = item.key === activeKey;
          const color = active ? '#f97316' : '#8d94a3';
          const iconSize = item.featured ? 28 : 24;

          return (
            <Pressable
              key={item.key}
              onPress={() => onTabPress?.(item.key)}
              style={styles.navItem}
            >
              {item.featured ? (
                <View style={styles.featuredNavOuter}>
                  <View style={[styles.featuredNavInner, active && styles.featuredNavInnerActive]}>
                    <NavIcon {...item.icon} size={iconSize} color="#ffffff" />
                  </View>
                </View>
              ) : (
                <NavIcon {...item.icon} size={iconSize} color={color} />
              )}
              <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    width: '100%',
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#fed7aa',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerBar: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 3,
  },
  brandText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f97316',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ghostButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#374151',
  },
  primaryButton: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  bottomNavWrap: {
    width: '100%',
    backgroundColor: '#fffaf5',
    borderTopWidth: 1,
    borderTopColor: '#f3e1cf',
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  bottomNavBar: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 26,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 6,
    shadowColor: '#8b5e34',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 12,
    elevation: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  featuredNavOuter: {
    marginTop: -28,
    marginBottom: 6,
    padding: 3,
    borderRadius: 24,
    backgroundColor: '#fff4eb',
  },
  featuredNavInner: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#fb923c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f97316',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
    elevation: 5,
  },
  featuredNavInnerActive: {
    backgroundColor: '#f97316',
  },
  navLabel: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#8d94a3',
    textAlign: 'center',
  },
  navLabelActive: {
    color: '#f97316',
  },
});
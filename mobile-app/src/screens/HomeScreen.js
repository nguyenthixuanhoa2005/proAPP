import React from 'react';
import {
  Alert,
  Keyboard,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppBottomNav, AppHeader } from '../components/AppChrome';

const TRENDING_RECIPES = [
  {
    id: 'pho-ha-noi',
    title: 'Pho bo Ha Noi',
    author: 'Chef Minh',
    timeLabel: '180p',
    views: '1,240',
    likes: '256',
    rating: '4.8',
    premium: true,
    image:
      'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'tom-sa-te',
    title: 'Tom sot sa te',
    author: 'Chef Linh',
    timeLabel: '45p',
    views: '890',
    likes: '188',
    rating: '4.9',
    premium: false,
    image:
      'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'ga-nuong-mat-ong',
    title: 'Ga nuong mat ong',
    author: 'Chef Bao',
    timeLabel: '60p',
    views: '1,032',
    likes: '302',
    rating: '4.7',
    premium: false,
    image:
      'https://images.unsplash.com/photo-1604908554007-5226d04e0f24?auto=format&fit=crop&w=1200&q=80',
  },
];

const RecipeCard = ({ recipe, isGuest, onProtectedAction }) => {
  const guardPress = () => {
    if (isGuest) {
      onProtectedAction?.();
      return;
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: recipe.image }} style={styles.recipeImage} />

        <Pressable style={styles.favoriteFab} onPress={guardPress}>
          <Feather name="heart" size={20} color="#4b5563" />
        </Pressable>

        <View style={styles.ratingChip}>
          <MaterialCommunityIcons name="star" size={15} color="#fbbf24" />
          <Text style={styles.ratingText}>{recipe.rating}</Text>
        </View>

        {recipe.premium ? (
          <View style={styles.lockBanner}>
            <Feather name="lock" size={13} color="#ffffff" />
            <Text style={styles.lockText}>Dang ky de xem chi tiet dinh duong</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.recipeTitle}>{recipe.title}</Text>
        <Text style={styles.recipeAuthor}>Boi {recipe.author}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            <MaterialCommunityIcons name="clock-time-four-outline" size={15} color="#6b7280" />
            <Text style={styles.metaText}>{recipe.timeLabel}</Text>
          </View>
          <View style={styles.metaLeft}>
            <Feather name="eye" size={15} color="#6b7280" />
            <Text style={styles.metaText}>{recipe.views}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.engagementRow}>
          <View style={styles.metaLeft}>
            <Feather name="heart" size={16} color="#6b7280" />
            <Text style={styles.metaText}>{recipe.likes}</Text>
          </View>
          <Pressable onPress={guardPress}>
            <Feather name="share-2" size={17} color="#6b7280" />
          </Pressable>
        </View>

        <Pressable style={styles.ctaButton} onPress={guardPress}>
          <Text style={styles.ctaButtonText}>Xem cong thuc</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default function HomeScreen({ onLoginPress, onSignupPress, onRequestLogout, isGuest = true }) {
  const promptLogin = () => {
    Alert.alert('Yeu cau dang nhap', 'Vui long dang nhap de su dung tinh nang nay.', [
      { text: 'De sau', style: 'cancel' },
      {
        text: 'Dang nhap',
        onPress: () => onLoginPress?.(),
      },
    ]);
  };

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'profile') {
      Alert.alert('Tài khoản', 'Bạn muốn đăng xuất?', [
        { text: 'Huỷ', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => {
            if (typeof onRequestLogout === 'function') {
              onRequestLogout();
            }
          },
        },
      ]);
      return;
    }

    if (tabKey !== 'home') {
      Alert.alert('Thông báo', `Tab ${tabKey} sẽ được nối ở bước tiếp theo.`);
    }
  };

  const handleProtectedAction = () => {
    if (isGuest) {
      promptLogin();
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader
        onLoginPress={onLoginPress}
        onSignupPress={onSignupPress}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.searchCard}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={20} color="#9ca3af" />
            <TextInput
              placeholder="Tim kiem cong thuc..."
              placeholderTextColor="#9ca3af"
              style={styles.searchInput}
              editable={!isGuest}
              onFocus={() => {
                if (isGuest) {
                  Keyboard.dismiss();
                  promptLogin();
                }
              }}
            />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Cong thuc Trending</Text>
          <Pressable onPress={handleProtectedAction}>
            <Text style={styles.seeAllText}>Xem tat ca</Text>
          </Pressable>
        </View>

        {TRENDING_RECIPES.map((recipe) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            isGuest={isGuest}
            onProtectedAction={handleProtectedAction}
          />
        ))}
      </ScrollView>

      {!isGuest ? (
        <AppBottomNav
          role="user"
          activeKey="home"
          onTabPress={handleBottomTabPress}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef1f5',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  searchWrap: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 15,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    color: '#f55f12',
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#111827',
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  imageWrap: {
    position: 'relative',
    height: 188,
    backgroundColor: '#d1d5db',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
  },
  favoriteFab: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    minHeight: 34,
    borderRadius: 17,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  lockBanner: {
    position: 'absolute',
    left: 10,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
  },
  lockText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  recipeAuthor: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 15,
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginBottom: 10,
  },
  engagementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ctaButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
});

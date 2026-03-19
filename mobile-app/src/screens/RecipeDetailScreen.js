import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { authRequest, request } from '../services/client';

const FALLBACK_RECIPE_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80';

const formatNumber = (value) => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

const safeArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const difficultyLabel = (value) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'EASY') return 'Dễ';
  if (normalized === 'MEDIUM') return 'Trung bình';
  if (normalized === 'HARD') return 'Khó';
  return 'Chưa cập nhật';
};

const dishTypeLabel = (value) => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'MAIN_DISH') return 'Món chính';
  if (normalized === 'SIDE_DISH') return 'Món phụ';
  if (normalized === 'DRINK') return 'Đồ uống';
  return 'Khác';
};

export default function RecipeDetailScreen({
  recipeId,
  isGuest = true,
  onBack,
  onLoginPress,
}) {
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [submittingFavorite, setSubmittingFavorite] = useState(false);

  const fetchRecipeDetail = useCallback(async () => {
    if (!recipeId) {
      return;
    }

    try {
      setLoading(true);
      const data = await request(`/api/recipes/${recipeId}`);
      setRecipe(data?.recipe || null);

      if (!isGuest) {
        try {
          const favoriteStatus = await authRequest(`/api/recipes/${recipeId}/favorite-status`);
          setIsFavorite(Boolean(favoriteStatus?.isFavorite));
        } catch {
          setIsFavorite(false);
        }
      } else {
        setIsFavorite(false);
      }
    } catch (error) {
      Alert.alert('Lỗi tải công thức', error.message || 'Không thể tải chi tiết công thức.');
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  }, [isGuest, recipeId]);

  useEffect(() => {
    fetchRecipeDetail();
  }, [fetchRecipeDetail]);

  const ingredients = useMemo(() => safeArray(recipe?.ingredients_json), [recipe]);
  const steps = useMemo(() => safeArray(recipe?.steps_json), [recipe]);

  const handleShareRecipe = async () => {
    if (!recipe) {
      return;
    }

    try {
      const shareUrl = `https://nutrichef.app/recipes/${recipe.recipe_id}`;
      await Share.share({
        message: `Cùng xem công thức ${recipe.title} trên NutriChef: ${shareUrl}`,
        title: recipe.title,
        url: shareUrl,
      });
    } catch (error) {
      Alert.alert('Lỗi chia sẻ', error.message || 'Không thể chia sẻ công thức này.');
    }
  };

  const handleToggleFavorite = async () => {
    if (!recipe?.recipe_id) {
      return;
    }

    if (isGuest) {
      Alert.alert('Yêu cầu đăng nhập', 'Bạn cần đăng nhập để lưu công thức yêu thích.', [
        { text: 'Để sau', style: 'cancel' },
        {
          text: 'Đăng nhập',
          onPress: () => onLoginPress?.(),
        },
      ]);
      return;
    }

    try {
      setSubmittingFavorite(true);
      const method = isFavorite ? 'DELETE' : 'POST';
      const response = await authRequest(`/api/recipes/${recipe.recipe_id}/favorite`, { method });
      const nextFavorite = Boolean(response?.isFavorite);
      const nextLikeCount = Number(response?.likeCount);

      setIsFavorite(nextFavorite);
      if (Number.isFinite(nextLikeCount)) {
        setRecipe((current) => {
          if (!current) {
            return current;
          }
          return {
            ...current,
            like_count: nextLikeCount,
          };
        });
      }
    } catch (error) {
      Alert.alert('Lỗi cập nhật yêu thích', error.message || 'Không thể cập nhật yêu thích.');
    } finally {
      setSubmittingFavorite(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#f55f12" />
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Feather name="arrow-left" size={18} color="#111827" />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </Pressable>
        </View>
        <View style={styles.emptyWrap}>
          <Feather name="inbox" size={22} color="#94a3b8" />
          <Text style={styles.emptyText}>Không tìm thấy công thức.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Feather name="arrow-left" size={18} color="#111827" />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Image source={{ uri: recipe.image_url || FALLBACK_RECIPE_IMAGE }} style={styles.heroImage} />

          <View style={styles.cardBody}>
            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.authorText}>Bởi {recipe.author_name || 'NutriChef'}</Text>

            <View style={styles.infoRow}>
              <View style={styles.infoChip}>
                <MaterialCommunityIcons name="clock-time-four-outline" size={15} color="#4b5563" />
                <Text style={styles.infoText}>{Number(recipe.cooking_time) || 0} phút</Text>
              </View>
              <View style={styles.infoChip}>
                <MaterialCommunityIcons name="star" size={15} color="#f59e0b" />
                <Text style={styles.infoText}>{Number(recipe.avg_rating || 0).toFixed(1)}</Text>
              </View>
              <View style={styles.infoChip}>
                <Feather name="heart" size={15} color="#ef4444" />
                <Text style={styles.infoText}>{formatNumber(recipe.like_count)}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoChipSecondary}>
                <Text style={styles.infoSecondaryText}>Độ khó: {difficultyLabel(recipe.difficulty)}</Text>
              </View>
              <View style={styles.infoChipSecondary}>
                <Text style={styles.infoSecondaryText}>Loại món: {dishTypeLabel(recipe.dish_type)}</Text>
              </View>
              <View style={styles.infoChipSecondary}>
                <Text style={styles.infoSecondaryText}>Kcal: {Number(recipe.total_calories) || 0}</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive, submittingFavorite && styles.disabledButton]}
                onPress={handleToggleFavorite}
                disabled={submittingFavorite}
              >
                <Feather name={isFavorite ? 'heart' : 'heart'} size={16} color={isFavorite ? '#ffffff' : '#ef4444'} />
                <Text style={[styles.favoriteButtonText, isFavorite && styles.favoriteButtonTextActive]}>
                  {isFavorite ? 'Đã yêu thích' : 'Yêu thích'}
                </Text>
              </Pressable>

              <Pressable style={styles.shareButton} onPress={handleShareRecipe}>
                <Feather name="share-2" size={16} color="#374151" />
                <Text style={styles.shareButtonText}>Chia sẻ</Text>
              </Pressable>
            </View>

            {recipe.description ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mô tả món ăn</Text>
                <Text style={styles.sectionContent}>{recipe.description}</Text>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nguyên liệu</Text>
              {ingredients.length === 0 ? (
                <Text style={styles.placeholderText}>Chưa có dữ liệu nguyên liệu.</Text>
              ) : (
                ingredients.map((item, index) => (
                  <View key={`ing-${index}`} style={styles.listRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.listText}>
                      {item?.name || 'Nguyên liệu'} {item?.qty ? `- ${item.qty}` : ''} {item?.unit || ''}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cách làm</Text>
              {steps.length === 0 ? (
                <Text style={styles.placeholderText}>Chưa có dữ liệu các bước nấu.</Text>
              ) : (
                steps.map((item, index) => (
                  <View key={`step-${index}`} style={styles.stepRow}>
                    <View style={styles.stepBadge}>
                      <Text style={styles.stepBadgeText}>{item?.step || index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{item?.content || ''}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 24,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    marginBottom: 10,
  },
  backButton: {
    minHeight: 38,
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backButtonText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 230,
    backgroundColor: '#d1d5db',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  authorText: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 15,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  infoChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  infoText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  infoChipSecondary: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#ffffff',
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSecondaryText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 10,
  },
  favoriteButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  favoriteButtonActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  favoriteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  favoriteButtonTextActive: {
    color: '#ffffff',
  },
  shareButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  shareButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  sectionContent: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    marginTop: 1,
    color: '#111827',
    fontWeight: '700',
  },
  listText: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
    lineHeight: 21,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
});

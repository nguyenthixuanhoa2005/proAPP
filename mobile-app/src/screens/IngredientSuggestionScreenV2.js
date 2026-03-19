import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import {
  Feather,
  Ionicons,
  MaterialCommunityIcons,
  AntDesign,
} from '@expo/vector-icons';
import { AppBottomNav, AppHeader } from '../components/AppChrome';
import { API_BASE_URL, request } from '../services/client';

const INPUT_METHODS = [
  {
    key: 'list',
    label: 'Chọn từ danh sách',
    icon: { family: Ionicons, name: 'nutrition-outline', color: '#ff5a00' },
  },
  {
    key: 'text',
    label: 'Nhập text',
    icon: { family: Ionicons, name: 'paper-plane-outline', color: '#2f6df6' },
  },
  {
    key: 'voice',
    label: 'Giọng nói',
    icon: { family: Feather, name: 'mic', color: '#ff2d2d' },
  },
  {
    key: 'image',
    label: 'Chụp ảnh',
    icon: { family: Feather, name: 'camera', color: '#18a957' },
  },
];

const normalizeIngredient = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const parseIngredientText = (value) => {
  const seen = new Set();

  return String(value || '')
    .split(/[\n,;]+/)
    .map(normalizeIngredient)
    .filter((item) => {
      const lower = item.toLowerCase();
      if (!lower || seen.has(lower)) {
        return false;
      }
      seen.add(lower);
      return true;
    });
};

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CLASSIFIER_PREFIXES = new Set([
  'qua',
  'con',
  'trai',
  'cu',
  'cay',
  'la',
  'mieng',
  'khoanh',
  'lat',
  'hat',
]);

const stripClassifierPrefixes = (value) => {
  const tokens = normalizeText(value).split(' ').filter(Boolean);
  while (tokens.length > 1 && CLASSIFIER_PREFIXES.has(tokens[0])) {
    tokens.shift();
  }

  return tokens.join(' ');
};

const toKeywordTerms = (value) =>
  String(value || '')
    .split(/[\n,;|]+/)
    .map((part) => normalizeText(part))
    .filter(Boolean);

const parseStepList = (stepsJson) => {
  if (!Array.isArray(stepsJson)) {
    return [];
  }

  return stepsJson
    .map((step, index) => {
      if (typeof step === 'string') {
        return { step: index + 1, content: step };
      }

      return {
        step: Number(step?.step) || index + 1,
        content: String(step?.content || '').trim(),
      };
    })
    .filter((step) => step.content);
};

const parseIngredientList = (ingredientsJson) => {
  if (!Array.isArray(ingredientsJson)) {
    return [];
  }

  return ingredientsJson
    .map((item) => {
      const name = String(item?.name || '').trim();
      const qty = item?.qty;
      const unit = String(item?.unit || '').trim();

      if (!name) {
        return null;
      }

      const hasQty = qty !== undefined && qty !== null && qty !== '';
      const detail = hasQty ? `${qty}${unit ? ` ${unit}` : ''}` : unit;
      return { name, detail: String(detail || '').trim() };
    })
    .filter(Boolean);
};

const resolveRecipeImage = (imageUrl) => {
  const fallback = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80';
  if (!imageUrl) {
    return fallback;
  }

  const trimmed = String(imageUrl).trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed;
};

const InputMethodCard = ({ item, active, onPress }) => {
  const IconComponent = item.icon.family;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.methodCard, active && styles.methodCardActive]}
    >
      <IconComponent name={item.icon.name} size={22} color={item.icon.color} />
      <Text style={styles.methodCardText}>{item.label}</Text>
    </Pressable>
  );
};

export default function IngredientSuggestionScreenV2({
  isGuest = false,
  onLoginPress,
  onNavigateHome,
  onRequestLogout,
}) {
  const [recording, setRecording] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [voiceUri, setVoiceUri] = useState(null);
  const [voiceSource, setVoiceSource] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imageSource, setImageSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [inputMethod, setInputMethod] = useState('list');
  const [selectedTags, setSelectedTags] = useState([]);
  const [textInputValue, setTextInputValue] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [ingredientCatalog, setIngredientCatalog] = useState([]);
  const [detectFeedback, setDetectFeedback] = useState('');

  const ingredientOptions = useMemo(() => {
    const prioritized = [...ingredientCatalog].sort((left, right) => {
      const leftPopular = left.is_common ? 1 : 0;
      const rightPopular = right.is_common ? 1 : 0;
      if (rightPopular !== leftPopular) {
        return rightPopular - leftPopular;
      }

      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    return prioritized.slice(0, 30).map((item) => item.name);
  }, [ingredientCatalog]);

  useEffect(() => {
    let cancelled = false;

    const loadIngredientCatalog = async () => {
      try {
        setCatalogLoading(true);
        const data = await request('/api/ingredients', { method: 'GET' });
        if (cancelled) {
          return;
        }

        setIngredientCatalog(Array.isArray(data?.ingredients) ? data.ingredients : []);
      } catch (error) {
        if (!cancelled) {
          Alert.alert('Lỗi tải dữ liệu', error.message || 'Không tải được danh sách nguyên liệu.');
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    };

    loadIngredientCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateDetectedIngredients = (items) => {
    const cleaned = parseIngredientText((items || []).join(','));
    setIngredients(cleaned);
    setSuggestions([]);
    setSelectedRecipe(null);
    setDetectFeedback('');
    setStep(2);
  };

  const buildFilePayload = async (source, type) => {
    const fallbackName = type === 'voice' ? 'recording.wav' : 'photo.jpg';
    const fallbackType = type === 'voice' ? 'audio/wav' : 'image/jpeg';

    if (Platform.OS === 'web') {
      if (source?.file) {
        return {
          file: source.file,
          name: source.name || source.file.name || fallbackName,
        };
      }

      if (source?.uri) {
        const blobResponse = await fetch(source.uri);
        const blob = await blobResponse.blob();
        const fileType = source.type || blob.type || fallbackType;
        const fileName = source.name || fallbackName;
        const webFile = new File([blob], fileName, { type: fileType });
        return {
          file: webFile,
          name: fileName,
        };
      }

      return null;
    }

    if (!source?.uri) {
      return null;
    }

    return {
      uri: Platform.OS === 'android' ? source.uri : source.uri.replace('file://', ''),
      name: source.name || fallbackName,
      type: source.type || fallbackType,
    };
  };

  const uploadFileToServer = async (source, type) => {
    if (!source?.uri && !source?.file) {
      Alert.alert('Lỗi', 'Không có file để upload.');
      return;
    }

    setLoading(true);
    setSuggestions([]);
    setSelectedRecipe(null);
    setDetectFeedback('');

    const apiUrl = `${API_BASE_URL}/api/ai/detect-ingredients?type=${type}`;

    try {
      const formData = new FormData();
      const filePayload = await buildFilePayload(source, type);
      if (!filePayload) {
        throw new Error('Không tạo được dữ liệu file để upload.');
      }

      if (Platform.OS === 'web') {
        formData.append('file', filePayload.file, filePayload.name);
      } else {
        formData.append('file', filePayload);
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await response.json();

      const namesFromDb = Array.isArray(data?.ingredients)
        ? data.ingredients.map((item) => item?.name).filter(Boolean)
        : [];
      const namesFromAi = Array.isArray(data?.detected_ingredients)
        ? data.detected_ingredients.map((item) => String(item || '').trim()).filter(Boolean)
        : [];
      const names = namesFromDb.length > 0 ? namesFromDb : namesFromAi;

      if (response.ok && names.length > 0) {
        updateDetectedIngredients(names);
        return;
      }

      if (response.ok) {
        setIngredients([]);
        setDetectFeedback('Không tìm thấy nguyên liệu từ dữ liệu vừa gửi. Bạn thử ảnh rõ hơn hoặc thêm nguyên liệu thủ công.');
        return;
      }

      Alert.alert('Lỗi Server', data?.error || data?.message || 'Có lỗi xảy ra.');
    } catch (error) {
      setDetectFeedback('Không gửi được dữ liệu để nhận diện. Vui lòng kiểm tra kết nối backend/AI service.');
      Alert.alert('Lỗi kết nối', error.message || 'Không gọi được backend API.');
    } finally {
      setLoading(false);
    }
  };

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Thiếu quyền', 'Vui lòng cấp quyền ghi âm.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions = {
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(newRecording);
      setVoiceUri(null);
      setVoiceSource(null);
      setIsRecording(true);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể bắt đầu ghi âm.');
    }
  }

  async function stopRecording() {
    if (!recording) {
      return;
    }

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(undefined);
    const normalizedUri = uri || null;
    setVoiceUri(normalizedUri);
    setVoiceSource(
      normalizedUri
        ? {
            uri: normalizedUri,
            name: Platform.OS === 'web' ? 'recording.webm' : 'recording.wav',
            type: Platform.OS === 'web' ? 'audio/webm' : 'audio/wav',
          }
        : null
    );
  }

  const handleImagePicked = async (result) => {
    if (!result.canceled) {
      const asset = result.assets[0] || {};
      const uri = asset.uri;
      setImageUri(uri);
      setImageSource({
        uri,
        file: asset.file || null,
        name: asset.fileName || 'photo.jpg',
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const handleDetectVoiceIngredients = () => {
    if (!voiceUri) {
      Alert.alert('Thiếu dữ liệu', 'Bạn cần ghi âm trước khi nhận diện.');
      return;
    }

    uploadFileToServer(voiceSource, 'voice');
  };

  const handleDetectImageIngredients = () => {
    if (!imageUri) {
      Alert.alert('Thiếu dữ liệu', 'Bạn cần chụp ảnh hoặc chọn ảnh trước khi nhận diện.');
      return;
    }

    uploadFileToServer(imageSource, 'image');
  };

  const pickImageFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền', 'Cần quyền truy cập ảnh.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    handleImagePicked(result);
  };

  const takePhotoWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền', 'Cần quyền Camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    handleImagePicked(result);
  };

  const toggleIngredientTag = (item) => {
    setSelectedTags((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item]
    );
  };

  const handleContinueFromStepOne = () => {
    if (inputMethod === 'list') {
      if (selectedTags.length === 0) {
        Alert.alert('Thiếu dữ liệu', 'Hãy chọn ít nhất một nguyên liệu.');
        return;
      }

      setIngredients(selectedTags);
      setSuggestions([]);
      setSelectedRecipe(null);
      setStep(2);
      return;
    }

    if (inputMethod === 'text') {
      const parsed = parseIngredientText(textInputValue);
      if (parsed.length === 0) {
        Alert.alert('Thiếu dữ liệu', 'Hãy nhập ít nhất một nguyên liệu.');
        return;
      }

      setIngredients(parsed);
      setSuggestions([]);
      setSelectedRecipe(null);
      setStep(2);
      return;
    }

    Alert.alert('Chọn phương thức', 'Hãy dùng giọng nói hoặc ảnh để AI nhận diện nguyên liệu.');
  };

  const updateIngredientAt = (index, value) => {
    setIngredients((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item))
    );
  };

  const removeIngredientAt = (index) => {
    setIngredients((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const addIngredient = () => {
    setIngredients((current) => [...current, '']);
  };

  const mapNamesToIngredientIds = (names) => {
    const catalog = ingredientCatalog.map((item) => ({
      ...item,
      normalized: normalizeText(item.name),
      simplified: stripClassifierPrefixes(item.name),
      searchTerms: [
        normalizeText(item.name),
        stripClassifierPrefixes(item.name),
        ...toKeywordTerms(item.keywords),
        ...toKeywordTerms(item.keywords).map((term) => stripClassifierPrefixes(term)),
      ].filter(Boolean),
    }));

    const ids = new Set();
    names.forEach((name) => {
      const normalizedInput = normalizeText(name);
      const simplifiedInput = stripClassifierPrefixes(name);
      if (!normalizedInput) {
        return;
      }

      const matchedItems = catalog.filter((item) => {
        const hasDirectMatch = item.searchTerms.some(
          (term) =>
            term === normalizedInput ||
            term === simplifiedInput ||
            term.includes(normalizedInput) ||
            normalizedInput.includes(term) ||
            term.includes(simplifiedInput) ||
            simplifiedInput.includes(term)
        );

        if (hasDirectMatch) {
          return true;
        }

        const inputTokens = simplifiedInput.split(' ').filter(Boolean);
        if (inputTokens.length === 0) {
          return false;
        }

        return item.searchTerms.some((term) => {
          const termTokens = term.split(' ').filter(Boolean);
          return inputTokens.every((token) => termTokens.some((part) => part.includes(token)));
        });
      });

      matchedItems.forEach((item) => {
        ids.add(Number(item.ingredient_id));
      });
    });

    return [...ids].filter((id) => Number.isInteger(id) && id > 0);
  };

  const handleFindDishes = async () => {
    const cleaned = ingredients.map(normalizeIngredient).filter(Boolean);
    if (cleaned.length === 0) {
      Alert.alert('Thiếu dữ liệu', 'Danh sách nguyên liệu đang trống.');
      return;
    }

    const ingredientIds = mapNamesToIngredientIds(cleaned);
    if (ingredientIds.length === 0) {
      Alert.alert('Không tìm thấy', 'Không map được nguyên liệu với dữ liệu hệ thống.');
      return;
    }

    try {
      setLoading(true);
      setIngredients(cleaned);

      const data = await request('/api/recipes/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredient_ids: ingredientIds }),
      });

      const recipes = Array.isArray(data?.recipes) ? data.recipes : [];
      setSuggestions(recipes);
      setSelectedRecipe(recipes[0] || null);
      setStep(3);
    } catch (error) {
      Alert.alert('Lỗi gợi ý', error.message || 'Không lấy được danh sách món ăn.');
    } finally {
      setLoading(false);
    }
  };

  const findAnotherRecipe = () => {
    if (suggestions.length <= 1) {
      Alert.alert('Thông báo', 'Hiện tại chỉ có 1 món phù hợp.');
      return;
    }

    const currentIndex = suggestions.findIndex((item) => item.recipe_id === selectedRecipe?.recipe_id);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % suggestions.length : 0;
    setSelectedRecipe(suggestions[nextIndex]);
  };

  const handleBottomTabPress = (tabKey) => {
    if (tabKey === 'home') {
      onNavigateHome?.();
      return;
    }

    if (tabKey === 'profile') {
      Alert.alert('Tài khoản', 'Bạn muốn đăng xuất?', [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: () => onRequestLogout?.(),
        },
      ]);
      return;
    }

    if (tabKey !== 'suggest') {
      Alert.alert('Thông báo', `Tab ${tabKey} chưa được nối màn.`);
    }
  };

  const handleAccountPress = () => {
    Alert.alert('Tài khoản', 'Bạn muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => onRequestLogout?.(),
      },
    ]);
  };

  const renderStepOneContent = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Chọn cách nhập nguyên liệu</Text>
      <View style={styles.methodGrid}>
        {INPUT_METHODS.map((item) => (
          <InputMethodCard
            key={item.key}
            item={item}
            active={inputMethod === item.key}
            onPress={() => setInputMethod(item.key)}
          />
        ))}
      </View>

      {inputMethod === 'list' ? (
        <>
          <Text style={styles.fieldLabel}>Chọn nguyên liệu có sẵn:</Text>
          {catalogLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#ff5a00" />
              <Text style={styles.loadingText}>Đang tải nguyên liệu từ hệ thống...</Text>
            </View>
          ) : (
            <View style={styles.tagsContainer}>
              {ingredientOptions.map((item) => {
                const active = selectedTags.includes(item);
                return (
                  <Pressable
                    key={item}
                    onPress={() => toggleIngredientTag(item)}
                    style={[styles.tag, active && styles.tagActive]}
                  >
                    <Text style={[styles.tagText, active && styles.tagTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      ) : null}

      {inputMethod === 'text' ? (
        <>
          <Text style={styles.fieldLabel}>Nhập nguyên liệu, ngăn cách bằng dấu phẩy hoặc xuống dòng:</Text>
          <TextInput
            value={textInputValue}
            onChangeText={setTextInputValue}
            placeholder="Ví dụ: trứng, hành, cà chua"
            placeholderTextColor="#9aa4b2"
            multiline
            textAlignVertical="top"
            style={styles.textArea}
          />
        </>
      ) : null}

      {inputMethod === 'voice' ? (
        <View style={styles.actionPanel}>
          <Text style={styles.panelDescription}>Nhấn để ghi âm tên nguyên liệu, sau đó AI sẽ tự nhận diện.</Text>
          <Pressable
            onPress={isRecording ? stopRecording : startRecording}
            style={[styles.primaryButton, isRecording && styles.recordingButton]}
          >
            <Feather name={isRecording ? 'square' : 'mic'} size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>
              {isRecording ? 'Dừng và gửi' : 'Bắt đầu ghi âm'}
            </Text>
          </Pressable>
          {!isRecording ? (
            <Pressable onPress={handleDetectVoiceIngredients} style={[styles.secondaryActionButton, styles.detectActionButton]}>
              <Feather name="mic" size={18} color="#ff5a00" />
              <Text style={styles.secondaryActionText}>Nhận diện giọng nói</Text>
            </Pressable>
          ) : null}
          {detectFeedback ? <Text style={styles.detectFeedbackText}>{detectFeedback}</Text> : null}
        </View>
      ) : null}

      {inputMethod === 'image' ? (
        <View style={styles.actionPanel}>
          <Text style={styles.panelDescription}>Chụp ảnh hoặc chọn từ thư viện để AI nhận diện nguyên liệu.</Text>
          <View style={styles.imageActionRow}>
            <Pressable onPress={takePhotoWithCamera} style={styles.secondaryActionButton}>
              <Feather name="camera" size={18} color="#ff5a00" />
              <Text style={styles.secondaryActionText}>Chụp ảnh</Text>
            </Pressable>
            <Pressable onPress={pickImageFromGallery} style={styles.secondaryActionButton}>
              <Feather name="image" size={18} color="#ff5a00" />
              <Text style={styles.secondaryActionText}>Thư viện</Text>
            </Pressable>
          </View>
          <Pressable onPress={handleDetectImageIngredients} style={[styles.secondaryActionButton, styles.detectActionButton]}>
            <Feather name="search" size={18} color="#ff5a00" />
            <Text style={styles.secondaryActionText}>Nhận diện nguyên liệu</Text>
          </Pressable>
          {detectFeedback ? <Text style={styles.detectFeedbackText}>{detectFeedback}</Text> : null}
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color="#ff5a00" />
          <Text style={styles.loadingText}>Đang xử lý...</Text>
        </View>
      ) : null}

      {(inputMethod === 'list' || inputMethod === 'text') ? (
        <Pressable onPress={handleContinueFromStepOne} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Tiếp tục</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderStepTwoContent = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Kiểm tra và chỉnh sửa nguyên liệu</Text>
      <Text style={styles.descriptionText}>
        Hệ thống đã nhận diện được {ingredients.filter((item) => normalizeIngredient(item)).length} nguyên liệu. Vui lòng kiểm tra và điều chỉnh.
      </Text>

      <View style={styles.editorList}>
        {ingredients.map((item, index) => (
          <View key={`ingredient-row-${index}`} style={styles.editorRow}>
            <View style={styles.editorIconBox}>
              <Ionicons name="nutrition-outline" size={18} color="#ff5a00" />
            </View>
            <TextInput
              value={item}
              onChangeText={(value) => updateIngredientAt(index, value)}
              placeholder="Tên nguyên liệu"
              placeholderTextColor="#98a2b3"
              style={styles.editorInput}
            />
            <Pressable onPress={() => removeIngredientAt(index)} style={styles.deleteButton}>
              <AntDesign name="delete" size={18} color="#ff3b30" />
            </Pressable>
          </View>
        ))}
      </View>

      <Pressable onPress={addIngredient} style={styles.addMoreButton}>
        <AntDesign name="plus" size={18} color="#ff5a00" />
        <Text style={styles.addMoreText}>Thêm nguyên liệu khác</Text>
      </Pressable>

      <View style={styles.footerActions}>
        <Pressable onPress={() => setStep(1)} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Quay lại</Text>
        </Pressable>
        <Pressable onPress={handleFindDishes} style={[styles.primaryButton, styles.flexButton]}>
          <Text style={styles.primaryButtonText}>Tìm món ăn</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderRecipeDetail = () => {
    if (!selectedRecipe) {
      return (
        <View style={styles.emptySuggestion}>
          <Text style={styles.emptySuggestionText}>Chưa có món phù hợp với danh sách nguyên liệu hiện tại.</Text>
        </View>
      );
    }

    const recipeIngredients = parseIngredientList(selectedRecipe.ingredients_json);
    const recipeSteps = parseStepList(selectedRecipe.steps_json);

    return (
      <View style={styles.recipeDetailCard}>
        <View style={styles.recipeHeroWrap}>
          <Image source={{ uri: resolveRecipeImage(selectedRecipe.image_url) }} style={styles.recipeHeroImage} />
          <View style={styles.recipeImageActions}>
            <Pressable
              onPress={() => Alert.alert('Yêu thích', `Đã thêm "${selectedRecipe.title}" vào yêu thích (demo UI).`)}
              style={styles.recipeImageActionButton}
              hitSlop={8}
            >
              <Feather name="heart" size={18} color="#ef4444" />
            </Pressable>
            <Pressable
              onPress={() => Alert.alert('Chia sẻ', `Copy link chia sẻ cho "${selectedRecipe.title}" (demo UI).`)}
              style={styles.recipeImageActionButton}
              hitSlop={8}
            >
              <Feather name="share-2" size={18} color="#344054" />
            </Pressable>
          </View>
        </View>
        <Text style={styles.recipeDetailTitle}>{selectedRecipe.title}</Text>

        <View style={styles.recipeMetaRow}>
          <Text style={styles.recipeMetaItem}>Thời gian: {selectedRecipe.cooking_time || '--'} phút</Text>
          <Text style={styles.recipeMetaItem}>Độ khó: {selectedRecipe.difficulty || '--'}</Text>
          <Text style={styles.recipeMetaItem}>Calories: {selectedRecipe.total_calories || 0} kcal</Text>
        </View>

        <Text style={styles.sectionTitle}>Nguyên liệu cần thiết:</Text>
        <View style={styles.bulletList}>
          {recipeIngredients.map((item) => (
            <Text key={`${item.name}-${item.detail}`} style={styles.bulletText}>
              - {item.name}{item.detail ? ` (${item.detail})` : ''}
            </Text>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Cách làm:</Text>
        <View style={styles.stepsList}>
          {recipeSteps.map((step) => (
            <View key={`${step.step}-${step.content}`} style={styles.stepRow}>
              <View style={styles.stepIndexBubble}>
                <Text style={styles.stepIndexText}>{step.step}</Text>
              </View>
              <Text style={styles.stepContent}>{step.content}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderStepThreeContent = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Kết quả gợi ý món ăn</Text>
      <Text style={styles.descriptionText}>Toàn bộ dữ liệu được lấy trực tiếp từ cơ sở dữ liệu.</Text>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Nguyên liệu đã chọn</Text>
        <View style={styles.summaryTags}>
          {ingredients.map((item) => (
            <View key={item} style={styles.summaryTag}>
              <Text style={styles.summaryTagText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recipeTabs} contentContainerStyle={styles.recipeTabsContent}>
        {suggestions.map((dish) => {
          const active = dish.recipe_id === selectedRecipe?.recipe_id;
          return (
            <Pressable key={dish.recipe_id} style={[styles.recipeTab, active && styles.recipeTabActive]} onPress={() => setSelectedRecipe(dish)}>
              <Text style={[styles.recipeTabText, active && styles.recipeTabTextActive]}>{dish.title}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {renderRecipeDetail()}

      <View style={styles.footerActions}>
        <Pressable onPress={findAnotherRecipe} style={[styles.primaryButton, styles.flexButton]}>
          <Text style={styles.primaryButtonText}>Tìm món khác</Text>
        </Pressable>
        <Pressable onPress={onNavigateHome} style={styles.outlineButton}>
          <Text style={styles.outlineButtonText}>Quay lại Trang chủ</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader
        onLoginPress={onLoginPress}
        onSignupPress={onLoginPress}
        isGuest={isGuest}
        notificationCount={3}
        onNotificationPress={() => Alert.alert('Thông báo', 'Bạn chưa có thông báo mới.')}
        onAccountPress={handleAccountPress}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="creation-outline" size={30} color="#9135ff" />
        </View>

        <Text style={styles.title}>Gợi ý món ăn thông minh</Text>
        <Text style={styles.subtitle}>Nhập nguyên liệu có sẵn, hệ thống sẽ gợi ý món ăn phù hợp từ DB</Text>

        {step === 1 ? renderStepOneContent() : null}
        {step === 2 ? renderStepTwoContent() : null}
        {step === 3 ? renderStepThreeContent() : null}
      </ScrollView>

      {!isGuest ? (
        <AppBottomNav
          activeKey="suggest"
          onTabPress={handleBottomTabPress}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#eedfff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#101828',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: '#475467',
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    width: '100%',
    maxWidth: 860,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 15,
    color: '#344054',
    marginBottom: 12,
    marginTop: 6,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  methodCard: {
    flexGrow: 1,
    minWidth: 140,
    height: 82,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#d0d5dd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: 8,
  },
  methodCardActive: {
    borderColor: '#ff5a00',
    backgroundColor: '#fff6f0',
  },
  methodCardText: {
    fontSize: 14,
    color: '#101828',
    textAlign: 'center',
    fontWeight: '500',
  },
  tagsContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#c7ced6',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  tagActive: {
    borderColor: '#ff5a00',
    backgroundColor: '#fff0e8',
  },
  tagText: {
    color: '#344054',
    fontSize: 14,
  },
  tagTextActive: {
    color: '#ff5a00',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#101828',
    backgroundColor: '#f9fafb',
  },
  actionPanel: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  panelDescription: {
    color: '#475467',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  imageActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  secondaryActionButton: {
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffd5bf',
    backgroundColor: '#fff4ed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  detectActionButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  detectFeedbackText: {
    marginTop: 10,
    color: '#b42318',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  secondaryActionText: {
    color: '#ff5a00',
    fontWeight: '600',
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: 14,
    marginTop: 12,
  },
  loadingState: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#475467',
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#ff5a00',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475467',
    marginBottom: 14,
  },
  editorList: {
    gap: 10,
  },
  editorRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#eef2f6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editorIconBox: {
    width: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingHorizontal: 10,
    fontSize: 15,
    color: '#101828',
    backgroundColor: '#ffffff',
  },
  deleteButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addMoreText: {
    color: '#ff5a00',
    fontSize: 15,
    fontWeight: '600',
  },
  footerActions: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  outlineButton: {
    flex: 1,
    minWidth: 150,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c7ced6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#fff',
  },
  outlineButtonText: {
    color: '#344054',
    fontSize: 15,
    fontWeight: '600',
  },
  flexButton: {
    flex: 1,
    marginTop: 0,
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#475467',
    marginBottom: 8,
    fontWeight: '600',
  },
  summaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fff0e8',
  },
  summaryTagText: {
    color: '#ff5a00',
    fontWeight: '600',
    fontSize: 13,
  },
  recipeTabs: {
    marginTop: 14,
  },
  recipeTabsContent: {
    gap: 8,
  },
  recipeTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  recipeTabActive: {
    backgroundColor: '#ff5a00',
  },
  recipeTabText: {
    fontSize: 13,
    color: '#344054',
    fontWeight: '600',
  },
  recipeTabTextActive: {
    color: '#fff',
  },
  recipeDetailCard: {
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    backgroundColor: '#fff',
  },
  recipeHeroWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  recipeHeroImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  recipeImageActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  recipeImageActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e7ec',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeDetailTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  recipeMetaRow: {
    marginTop: 8,
    gap: 6,
  },
  recipeMetaItem: {
    fontSize: 14,
    color: '#475467',
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
  },
  bulletList: {
    gap: 6,
  },
  bulletText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  stepsList: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  stepIndexBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ff5a00',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepIndexText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  emptySuggestion: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eaecf0',
    padding: 12,
  },
  emptySuggestionText: {
    color: '#64748b',
    fontSize: 14,
  },
});

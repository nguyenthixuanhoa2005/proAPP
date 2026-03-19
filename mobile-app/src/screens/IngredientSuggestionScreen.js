import React, { useState } from 'react';
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

const YOUR_PC_IP = '192.168.1.21';
const PYTHON_PORT = '5000';
const BASE_URL = `http://${YOUR_PC_IP}:${PYTHON_PORT}`;

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
    pro: true,
  },
  {
    key: 'image',
    label: 'Chụp ảnh',
    icon: { family: Feather, name: 'camera', color: '#18a957' },
    pro: true,
  },
];

const INGREDIENT_OPTIONS = [
  'Thịt bò',
  'Thịt gà',
  'Thịt lợn',
  'Cá hồi',
  'Tôm',
  'Mực',
  'Trứng gà',
  'Trứng vịt',
  'Đậu phụ',
  'Đậu hũ',
  'Cơm',
  'Mì',
  'Bún',
  'Phở',
  'Miến',
  'Cà chua',
  'Hành lá',
  'Tỏi',
  'Ớt',
  'Rau muống',
  'Cải xanh',
  'Khoai tây',
  'Cà rốt',
  'Bí đỏ',
  'Su hào',
  'Nấm',
  'Gia vị',
  'Dầu ăn',
  'Nước mắm',
  'Muối',
];

const SUGGESTION_LIBRARY = [
  {
    title: 'Trứng chiên hành',
    description: 'Món nhanh, dễ làm, hợp bữa sáng hoặc ăn kèm cơm nóng.',
    ingredients: ['trứng', 'hành'],
  },
  {
    title: 'Canh cà chua trứng',
    description: 'Canh thanh vị, nấu nhanh với trứng và cà chua.',
    ingredients: ['trứng', 'cà chua'],
  },
  {
    title: 'Thịt bò xào nấm',
    description: 'Bò xào thơm với nấm, hợp ăn cùng cơm trắng.',
    ingredients: ['thịt bò', 'nấm'],
  },
  {
    title: 'Tôm rang mặn ngọt',
    description: 'Tôm rang đậm đà với gia vị cơ bản và hành tỏi.',
    ingredients: ['tôm', 'hành', 'tỏi'],
  },
  {
    title: 'Đậu phụ sốt cà chua',
    description: 'Đậu phụ mềm, sốt cà chua dịu vị, dễ ăn.',
    ingredients: ['đậu phụ', 'cà chua'],
  },
  {
    title: 'Rau muống xào tỏi',
    description: 'Món rau đơn giản, hợp với bữa cơm gia đình.',
    ingredients: ['rau muống', 'tỏi'],
  },
  {
    title: 'Mì xào trứng',
    description: 'Mì xào nhanh gọn với trứng và rau tùy chọn.',
    ingredients: ['mì', 'trứng'],
  },
  {
    title: 'Canh bí đỏ thịt bằm',
    description: 'Canh ngọt vị bí đỏ, dễ ăn và đủ chất.',
    ingredients: ['bí đỏ', 'thịt lợn'],
  },
];

const normalizeIngredient = (value) => value.trim().replace(/\s+/g, ' ');

const parseIngredientText = (value) => {
  const seen = new Set();

  return value
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

const buildSuggestions = (ingredients) => {
  const lowered = ingredients.map((item) => item.toLowerCase());

  const ranked = SUGGESTION_LIBRARY.map((dish) => {
    const matched = dish.ingredients.filter((ingredient) =>
      lowered.some((item) => item.includes(ingredient) || ingredient.includes(item))
    );

    return {
      ...dish,
      matchedCount: matched.length,
      matchedIngredients: matched,
    };
  })
    .filter((dish) => dish.matchedCount > 0)
    .sort((left, right) => right.matchedCount - left.matchedCount)
    .slice(0, 4);

  if (ranked.length > 0) {
    return ranked;
  }

  return [
    {
      title: 'Món xào tổng hợp',
      description: 'Kết hợp các nguyên liệu hiện có để làm một món xào nhanh với gia vị cơ bản.',
      ingredients: ingredients.map((item) => item.toLowerCase()),
      matchedCount: ingredients.length,
      matchedIngredients: ingredients,
    },
  ];
};

const StepIndicator = ({ index, label, status }) => {
  const isCurrent = status === 'current';
  const isCompleted = status === 'completed';

  return (
    <View style={styles.stepItem}>
      <View
        style={[
          styles.stepCircle,
          isCurrent && styles.stepCircleCurrent,
          isCompleted && styles.stepCircleCompleted,
        ]}
      >
        <Text
          style={[
            styles.stepNumber,
            (isCurrent || isCompleted) && styles.stepNumberActive,
          ]}
        >
          {index}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        style={[
          styles.stepLabel,
          isCurrent && styles.stepLabelCurrent,
          isCompleted && styles.stepLabelCompleted,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const InputMethodCard = ({ item, active, onPress }) => {
  const IconComponent = item.icon.family;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.methodCard, active && styles.methodCardActive]}
    >
      {item.pro ? (
        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      ) : null}
      <IconComponent name={item.icon.name} size={22} color={item.icon.color} />
      <Text style={styles.methodCardText}>{item.label}</Text>
    </Pressable>
  );
};

export default function IngredientSuggestionScreen() {
  const [recording, setRecording] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [inputMethod, setInputMethod] = useState('list');
  const [selectedTags, setSelectedTags] = useState([]);
  const [textInputValue, setTextInputValue] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const resetFlow = () => {
    setStep(1);
    setInputMethod('list');
    setSelectedTags([]);
    setTextInputValue('');
    setIngredients([]);
    setSuggestions([]);
    setImageUri(null);
    setLoading(false);
    setIsRecording(false);
    setRecording(undefined);
  };

  const updateDetectedIngredients = (items) => {
    const cleaned = parseIngredientText(items.join(','));
    setIngredients(cleaned);
    setSuggestions([]);
    setStep(2);
  };

  const uploadFileToServer = async (fileUri, type) => {
    if (!fileUri) {
      Alert.alert('Lỗi', 'Không có file để upload');
      return;
    }

    setLoading(true);
    setSuggestions([]);

    const endpoint = type === 'voice' ? '/detect/voice' : '/detect/image';
    const apiUrl = `${BASE_URL}${endpoint}`;

    try {
      const formData = new FormData();
      const fileToUpload = {
        uri: Platform.OS === 'android' ? fileUri : fileUri.replace('file://', ''),
        name: type === 'voice' ? 'recording.wav' : 'photo.jpg',
        type: type === 'voice' ? 'audio/wav' : 'image/jpeg',
      };

      formData.append('file', fileToUpload);

      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: {
          Accept: 'application/json',
        },
      });

      const data = await response.json();

      if (data.status === 'success') {
        if (data.detected_ingredients?.length > 0) {
          updateDetectedIngredients(data.detected_ingredients);
        } else {
          setIngredients([]);
          Alert.alert('Thông báo', 'AI không nhận diện được nguyên liệu nào.');
        }
      } else {
        Alert.alert('Lỗi Server', data.error || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Lỗi Upload:', error);
      Alert.alert('Lỗi kết nối', `Không gọi được Server ${PYTHON_PORT}. Hãy kiểm tra kết nối mạng và Firewall.`);
    } finally {
      setLoading(false);
    }
  };

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Thiếu quyền', 'Vui lòng cấp quyền ghi âm');
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
      setIsRecording(true);
    } catch (error) {
      console.error('Lỗi Mic:', error);
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
    uploadFileToServer(uri, 'voice');
  }

  const handleImagePicked = async (result) => {
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      uploadFileToServer(uri, 'image');
    }
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

  const handleFindDishes = () => {
    const cleaned = ingredients.map(normalizeIngredient).filter(Boolean);
    if (cleaned.length === 0) {
      Alert.alert('Thiếu dữ liệu', 'Danh sách nguyên liệu đang trống.');
      return;
    }

    setIngredients(cleaned);
    setSuggestions(buildSuggestions(cleaned));
    setStep(3);
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
          <View style={styles.tagsContainer}>
            {INGREDIENT_OPTIONS.map((item) => {
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
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.previewImage} /> : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color="#ff5a00" />
          <Text style={styles.loadingText}>Đang nhận diện nguyên liệu...</Text>
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
        Hệ thống đã nhận diện được {ingredients.filter((item) => normalizeIngredient(item)).length} nguyên liệu. Vui lòng kiểm tra và điều chỉnh:
      </Text>

      <View style={styles.editorList}>
        {ingredients.map((item, index) => (
          <View key={`${index}-${item}`} style={styles.editorRow}>
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

  const renderStepThreeContent = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Kết quả gợi ý món ăn</Text>
      <Text style={styles.descriptionText}>AI đề xuất các món phù hợp từ danh sách nguyên liệu bạn đã xác nhận.</Text>

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

      <View style={styles.suggestionList}>
        {suggestions.map((dish) => (
          <View key={dish.title} style={styles.suggestionCard}>
            <View style={styles.suggestionHeader}>
              <Text style={styles.suggestionTitle}>{dish.title}</Text>
              <View style={styles.matchBadge}>
                <Text style={styles.matchBadgeText}>{dish.matchedCount} khớp</Text>
              </View>
            </View>
            <Text style={styles.suggestionDescription}>{dish.description}</Text>
            <Text style={styles.suggestionMeta}>
              Khớp với: {dish.matchedIngredients.join(', ')}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.footerActions}>
        <Pressable onPress={resetFlow} style={[styles.primaryButton, styles.flexButton]}>
          <Text style={styles.primaryButtonText}>Bắt đầu lại</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader
        onLoginPress={() => Alert.alert('Thông báo', 'Chức năng đăng nhập sẽ được nối ở bước tiếp theo.')}
        onSignupPress={() => Alert.alert('Thông báo', 'Chức năng đăng ký sẽ được nối ở bước tiếp theo.')}
      />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons name="creation-outline" size={30} color="#9135ff" />
        </View>

        <Text style={styles.title}>Gợi ý món ăn thông minh</Text>
        <Text style={styles.subtitle}>Nhập nguyên liệu có sẵn, AI sẽ gợi ý món ăn phù hợp</Text>

        <View style={styles.stepperRow}>
          <StepIndicator index={1} label="Nhập nguyên liệu" status={step > 1 ? 'completed' : 'current'} />
          <View style={styles.stepLine} />
          <StepIndicator
            index={2}
            label="Xác nhận"
            status={step === 1 ? 'upcoming' : step === 2 ? 'current' : 'completed'}
          />
          <View style={styles.stepLine} />
          <StepIndicator index={3} label="Kết quả" status={step === 3 ? 'current' : 'upcoming'} />
        </View>

        {step === 1 ? renderStepOneContent() : null}
        {step === 2 ? renderStepTwoContent() : null}
        {step === 3 ? renderStepThreeContent() : null}
      </ScrollView>

      <AppBottomNav
        activeKey="suggest"
        onTabPress={(tabKey) => {
          if (tabKey !== 'suggest') {
            Alert.alert('Thông báo', `Tab ${tabKey} chưa được nối màn.`);
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
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#eedfff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#101828',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 25,
    color: '#475467',
    textAlign: 'center',
    maxWidth: 680,
  },
  stepperRow: {
    width: '100%',
    maxWidth: 860,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 30,
    marginBottom: 22,
  },
  stepItem: {
    width: 86,
    flexDirection: 'column',
    alignItems: 'center',
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#d0d5dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCurrent: {
    backgroundColor: '#ff5a00',
  },
  stepCircleCompleted: {
    backgroundColor: '#16a34a',
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  stepNumberActive: {
    color: '#ffffff',
  },
  stepLabel: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 17,
    color: '#98a2b3',
    textAlign: 'center',
  },
  stepLabelCurrent: {
    color: '#ff5a00',
    fontWeight: '600',
  },
  stepLabelCompleted: {
    color: '#16a34a',
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    minWidth: 20,
    height: 1.5,
    backgroundColor: '#c7ced6',
    marginHorizontal: 6,
    marginTop: 16,
  },
  card: {
    width: '100%',
    maxWidth: 860,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#101828',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#101828',
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 17,
    color: '#344054',
    marginBottom: 14,
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 24,
  },
  methodCard: {
    flexGrow: 1,
    minWidth: 150,
    flexBasis: 160,
    height: 92,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#d0d5dd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    position: 'relative',
    gap: 10,
  },
  methodCardActive: {
    borderColor: '#ff5a00',
    backgroundColor: '#fff6f0',
  },
  methodCardText: {
    fontSize: 16,
    color: '#101828',
    textAlign: 'center',
    fontWeight: '500',
  },
  proBadge: {
    position: 'absolute',
    top: -10,
    right: 10,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  tagsContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 9,
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
    fontSize: 15,
  },
  tagTextActive: {
    color: '#ff5a00',
    fontWeight: '600',
  },
  textArea: {
    minHeight: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#101828',
    backgroundColor: '#f9fafb',
  },
  actionPanel: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  panelDescription: {
    color: '#475467',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  imageActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  secondaryActionButton: {
    minWidth: 150,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ffd5bf',
    backgroundColor: '#fff4ed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: '#ff5a00',
    fontWeight: '600',
    fontSize: 15,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginTop: 16,
  },
  loadingState: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 15,
    color: '#475467',
  },
  primaryButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#ff5a00',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  recordingButton: {
    backgroundColor: '#dc2626',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#475467',
    marginBottom: 18,
  },
  editorList: {
    gap: 14,
  },
  editorRow: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#eef2f6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editorIconBox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    paddingHorizontal: 14,
    fontSize: 18,
    color: '#101828',
    backgroundColor: '#ffffff',
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreButton: {
    marginTop: 20,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addMoreText: {
    color: '#ff5a00',
    fontSize: 18,
    fontWeight: '600',
  },
  footerActions: {
    marginTop: 26,
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  outlineButton: {
    flex: 1,
    minWidth: 160,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#c7ced6',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  outlineButtonText: {
    color: '#344054',
    fontSize: 16,
    fontWeight: '600',
  },
  flexButton: {
    flex: 1,
    marginTop: 0,
  },
  summaryBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eaecf0',
  },
  summaryLabel: {
    fontSize: 15,
    color: '#475467',
    marginBottom: 12,
    fontWeight: '600',
  },
  summaryTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryTag: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#fff0e8',
  },
  summaryTagText: {
    color: '#ff5a00',
    fontWeight: '600',
  },
  suggestionList: {
    marginTop: 18,
    gap: 14,
  },
  suggestionCard: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f0f2f5',
    shadowColor: '#101828',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 1,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  suggestionTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#101828',
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ecfdf3',
  },
  matchBadgeText: {
    color: '#027a48',
    fontWeight: '700',
    fontSize: 12,
  },
  suggestionDescription: {
    marginTop: 10,
    color: '#475467',
    fontSize: 15,
    lineHeight: 22,
  },
  suggestionMeta: {
    marginTop: 12,
    color: '#ff5a00',
    fontSize: 14,
    fontWeight: '600',
  },
});
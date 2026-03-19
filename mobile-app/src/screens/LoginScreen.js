import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { Feather, FontAwesome } from '@expo/vector-icons';
import {
  loginWithEmail,
  loginWithGoogle,
} from '../services/authApi';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

WebBrowser.maybeCompleteAuthSession();

const InputField = ({ icon, placeholder, value, onChangeText, secureTextEntry = false }) => (
  <View style={styles.inputWrap}>
    <Feather name={icon} size={18} color="#98a2b3" />
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#98a2b3"
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={secureTextEntry}
      style={styles.input}
    />
  </View>
);

export default function LoginScreen({ onClose, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loadingType, setLoadingType] = useState('');
  const [rememberLogin, setRememberLogin] = useState(false);

  const authConfig = Constants.expoConfig?.extra?.auth || {};
  const googleConfig = authConfig.google || {};
  const configuredGoogleRedirectUri = String(googleConfig.redirectUri || '').trim().replace(/\/+$/, '');
  const expoOwner = Constants.expoConfig?.owner || '';
  const expoSlug = Constants.expoConfig?.slug || 'AppGoiY';
  const appScheme = String(Constants.expoConfig?.scheme || 'appgoiy').trim() || 'appgoiy';
  const isWeb = Platform.OS === 'web';
  const isExpoGo = Constants.appOwnership === 'expo' || (!isWeb && Constants.executionEnvironment === 'storeClient');
  const fallbackProxyRedirectUri = `https://auth.expo.io/@${expoOwner}/${expoSlug}`;

  // Expo Go cần proxy URL của Expo; build/app local dùng deep link scheme.
  const generatedRedirectUri = AuthSession.makeRedirectUri(
    isExpoGo
      ? { useProxy: true }
      : {
          scheme: appScheme,
          path: 'oauth/google',
        }
  );

  // Ưu tiên URI cấu hình sẵn cho Expo Go; Web/Standalone dùng generated URI (localhost hoặc scheme).
  const googleRedirectUri = (isExpoGo && !isWeb)
    ? (configuredGoogleRedirectUri || fallbackProxyRedirectUri)
    : generatedRedirectUri;

  const resolvedGoogleClientId =
    googleConfig.expoClientId ||
    googleConfig.webClientId ||
    googleConfig.androidClientId ||
    googleConfig.iosClientId ||
    '';

  // Hook của expo để tạo request login với Google.
  const [googleRequest, , promptGoogleLogin] = Google.useIdTokenAuthRequest({
    clientId: resolvedGoogleClientId,
    expoClientId: googleConfig.expoClientId || googleConfig.webClientId || resolvedGoogleClientId,
    iosClientId: googleConfig.iosClientId || undefined,
    androidClientId: googleConfig.androidClientId || undefined,
    webClientId: googleConfig.webClientId || resolvedGoogleClientId,
    redirectUri: googleRedirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  const canSubmit = useMemo(() => {
    return EMAIL_REGEX.test(email.trim()) && password.trim().length >= 6;
  }, [email, password]);

  const handleEmailLogin = async () => {
    if (!canSubmit) {
      Alert.alert('Thiếu dữ liệu', 'Vui lòng nhập email hợp lệ và mật khẩu từ 6 ký tự.');
      return;
    }

    try {
      setLoadingType('email');
      const response = await loginWithEmail({
        email: email.trim().toLowerCase(),
        password,
        rememberLogin,
      });

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(response?.user || null);
      }

      Alert.alert('Đăng nhập thành công', `Xin chào ${response?.user?.fullName || response?.user?.email}`);
    } catch (error) {
      Alert.alert('Đăng nhập thất bại', error.message || 'Không thể đăng nhập.');
    } finally {
      setLoadingType('');
    }
  };

  const handleGoogleLogin = async () => {
    const hasGoogleId = Boolean(resolvedGoogleClientId);
    if (!hasGoogleId) {
      Alert.alert(
        'Thiếu Google Client ID',
        'Vui lòng điền expoClientId hoặc webClientId vào file app.json.\n\nLấy tại: console.cloud.google.com'
      );
      return;
    }

    if (isExpoGo && !expoOwner) {
      Alert.alert(
        'Thiếu Expo owner',
        'File app.json cần thêm expo.owner (username Expo) để tạo redirect URL dạng https://auth.expo.io/@username/AppGoiY.\n\nChạy: npx expo whoami để lấy username.'
      );
      return;
    }

    if (isExpoGo && !googleRedirectUri.startsWith('https://auth.expo.io/')) {
      Alert.alert(
        'Redirect URI sai',
        `Redirect hiện tại: ${googleRedirectUri}\n\nCần dạng https://auth.expo.io/@${expoOwner}/${expoSlug}`
      );
      return;
    }

    try {
      setLoadingType('google');
      const oauthResult = await promptGoogleLogin(
        isExpoGo
          ? { useProxy: true, showInRecents: true }
          : { showInRecents: true }
      );
      if (oauthResult.type === 'error') {
        const details = oauthResult.params?.error_description || oauthResult.error?.message || oauthResult.params?.error;
        Alert.alert(
          'Google OAuth lỗi',
          `${details || 'Yêu cầu OAuth không hợp lệ.'}\n\nredirectUri runtime: ${googleRedirectUri}`
        );
        return;
      }

      if (oauthResult.type !== 'success') {
        return;
      }

      const idToken = oauthResult.params?.id_token || oauthResult.authentication?.idToken;
      if (!idToken) {
        Alert.alert('Google login lỗi', 'Không lấy được id_token từ Google.');
        return;
      }

      const response = await loginWithGoogle({
        idToken,
        rememberLogin,
      });

      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(response?.user || null);
        return;
      }

      Alert.alert('Google login OK', `Xin chào ${response?.user?.fullName || response?.user?.email}`);
    } catch (error) {
      Alert.alert('Google login lỗi', error.message || 'Không gọi được API Google login.');
    } finally {
      setLoadingType('');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.screen}
      >
        <View style={styles.topOverlay} />

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Đăng nhập</Text>
            <Pressable
              onPress={() => {
                if (typeof onClose === 'function') {
                  onClose();
                  return;
                }
                Alert.alert('Đóng', 'Bạn có thể nối sự kiện đóng modal tại đây.');
              }}
            >
              <Feather name="x" size={26} color="#98a2b3" />
            </Pressable>
          </View>

          <Text style={styles.label}>Email</Text>
          <InputField
            icon="mail"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Mật khẩu</Text>
          <InputField
            icon="lock"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            onPress={() => Alert.alert('Quên mật khẩu', 'Bạn có thể nối màn quên mật khẩu ở bước tiếp theo.')}
            style={styles.forgotWrap}
          >
            <Text style={styles.forgotText}>Quên mật khẩu?</Text>
          </Pressable>

          <Pressable
            onPress={() => setRememberLogin((current) => !current)}
            style={styles.rememberWrap}
          >
            <Feather
              name={rememberLogin ? 'check-square' : 'square'}
              size={18}
              color={rememberLogin ? '#f55f12' : '#98a2b3'}
            />
            <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
          </Pressable>

          <Pressable
            onPress={handleEmailLogin}
            disabled={loadingType === 'email'}
            style={[styles.loginButton, loadingType === 'email' && styles.loginButtonDisabled]}
          >
            {loadingType === 'email' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Đăng nhập</Text>
            )}
          </Pressable>

          <View style={styles.signupRow}>
            <Text style={styles.signupHint}>Chưa có tài khoản?</Text>
            <Pressable onPress={() => Alert.alert('Đăng ký', 'Bạn có thể nối màn đăng ký ở bước tiếp theo.') }>
              <Text style={styles.signupText}> Đăng ký</Text>
            </Pressable>
          </View>

          <View style={styles.orWrap}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>HOẶC</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.socialRow}>
            <Pressable
              onPress={handleGoogleLogin}
              disabled={loadingType === 'google'}
              style={styles.socialButton}
            >
              {loadingType === 'google' ? (
                <ActivityIndicator size="small" color="#5f6368" />
              ) : (
                <>
                  <FontAwesome name="google" size={18} color="#ea4335" />
                  <Text style={styles.socialText}> Google</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020a1f',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: '#020a1f',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 30,
    minHeight: 580,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#111827',
  },
  label: {
    marginTop: 6,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  forgotWrap: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  forgotText: {
    color: '#f55f12',
    fontSize: 15,
    fontWeight: '700',
  },
  rememberWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  rememberText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  loginButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f55f12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  loginButtonDisabled: {
    opacity: 0.8,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  signupHint: {
    color: '#6b7280',
    fontSize: 15,
  },
  signupText: {
    color: '#f55f12',
    fontSize: 15,
    fontWeight: '700',
  },
  orWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  orLine: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  orText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '700',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#ffffff',
  },
  socialText: {
    color: '#4b5563',
    fontSize: 15,
    fontWeight: '700',
  },
});

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import HomeScreen from './src/screens/HomeScreen';
import IngredientSuggestionScreen from './src/screens/IngredientSuggestionScreenV2';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import RecipeDetailScreen from './src/screens/RecipeDetailScreen';
import LoginScreen from './src/screens/LoginScreen';
import { bootstrapAuthSession, logout } from './src/services/authApi';

WebBrowser.maybeCompleteAuthSession();

export default function App() {
  const [activeScreen, setActiveScreen] = useState('home');
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const user = await bootstrapAuthSession();
        if (cancelled) {
          return;
        }

        setCurrentUser(user || null);
        const role = String(user?.primaryRole || '').toUpperCase();
        if (role === 'ADMIN') {
          setActiveScreen('admin');
          return;
        }

        setActiveScreen('home');
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      // Keep UX smooth even if revoke API fails; local tokens are still cleared by logout().
      console.log('Logout warning:', error?.message || error);
    } finally {
      setCurrentUser(null);
      setActiveScreen('login');
    }
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user || null);
    const role = String(user?.primaryRole || '').toUpperCase();
    if (role === 'ADMIN') {
      setActiveScreen('admin');
      return;
    }

    setActiveScreen('home');
  };

  const handleOpenRecipeDetail = (recipeId) => {
    if (!recipeId) {
      return;
    }

    setSelectedRecipeId(recipeId);
    setActiveScreen('recipe-detail');
  };

  const handleBackFromRecipeDetail = () => {
    setActiveScreen('home');
  };

  if (bootstrapping) {
    return (
      <View style={styles.bootScreen}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (activeScreen === 'login') {
    return (
      <LoginScreen
        onClose={() => setActiveScreen('home')}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  if (activeScreen === 'admin') {
    return <AdminDashboardScreen user={currentUser} onLogout={handleLogout} />;
  }

  if (activeScreen === 'suggest') {
    return (
      <IngredientSuggestionScreen
        isGuest={!currentUser}
        onLoginPress={() => setActiveScreen('login')}
        onNavigateHome={() => setActiveScreen('home')}
        onRequestLogout={handleLogout}
      />
    );
  }

  if (activeScreen === 'recipe-detail') {
    return (
      <RecipeDetailScreen
        recipeId={selectedRecipeId}
        isGuest={!currentUser}
        onBack={handleBackFromRecipeDetail}
        onLoginPress={() => setActiveScreen('login')}
      />
    );
  }

  return (
    <HomeScreen
      onLoginPress={() => setActiveScreen('login')}
      onSignupPress={() => setActiveScreen('login')}
      onRequestLogout={handleLogout}
      onNavigateSuggest={() => setActiveScreen('suggest')}
      onOpenRecipeDetail={handleOpenRecipeDetail}
      isGuest={!currentUser}
      user={currentUser}
    />
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
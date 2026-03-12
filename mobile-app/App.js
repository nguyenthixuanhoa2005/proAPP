import React, { useState } from 'react';
import HomeScreen from './src/screens/HomeScreen';
import AdminDashboardScreen from './src/screens/AdminDashboardScreen';
import LoginScreen from './src/screens/LoginScreen';
import { logout } from './src/services/authApi';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('home');
  const [currentUser, setCurrentUser] = useState(null);

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

  return (
    <HomeScreen
      onLoginPress={() => setActiveScreen('login')}
      onSignupPress={() => setActiveScreen('login')}
      onRequestLogout={handleLogout}
      isGuest={!currentUser}
    />
  );
}
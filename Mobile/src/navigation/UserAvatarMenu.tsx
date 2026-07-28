import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coachColors } from '../theme/colors';
import { useAuth } from '../auth/AuthContext';

const MENU_ANIMATION_MS = 150;

const UserAvatarMenu = () => {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animation, {
      toValue: open ? 1 : 0,
      duration: MENU_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  }, [open, animation]);

  const toggleMenu = () => setOpen((prev) => !prev);
  const closeMenu = () => setOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
  };

  return (
    <View>
      <Pressable testID="user-avatar-button" onPress={toggleMenu} hitSlop={8} style={styles.avatarButton}>
        <Ionicons name="person-circle-outline" size={28} color={coachColors.textPrimary} />
      </Pressable>

      <Modal transparent visible={open} animationType="none" onRequestClose={closeMenu}>
        <Pressable testID="user-avatar-menu-backdrop" style={styles.backdrop} onPress={closeMenu}>
          <Animated.View
            testID="user-avatar-menu"
            style={[
              styles.menu,
              {
                opacity: animation,
                transform: [
                  {
                    scale: animation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable testID="logout-menu-item" onPress={handleLogout} style={styles.menuItem}>
              <Text style={styles.menuItemText}>Cerrar sesión</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarButton: {
    marginRight: 12,
  },
  backdrop: {
    flex: 1,
    alignItems: 'flex-end',
  },
  menu: {
    marginTop: 56,
    marginRight: 12,
    backgroundColor: coachColors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coachColors.border,
    minWidth: 160,
    paddingVertical: 4,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    color: coachColors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
});

export default UserAvatarMenu;

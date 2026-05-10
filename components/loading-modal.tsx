import React, { useEffect, useMemo } from 'react';
import { View, Text, Modal, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { getThemePalette } from '@/constants/theme-palettes';
import { useSchoolConfig } from '@/lib/school-config';
import { IconSymbol } from '@/components/ui/icon-symbol';

export type LoadingStatus = 'loading' | 'success' | 'error' | 'idle';

interface LoadingModalProps {
  visible: boolean;
  status: LoadingStatus;
  message?: string;
  onClose?: () => void;
  autoCloseMs?: number;
  autoCloseOn?: LoadingStatus[];
  showActionButton?: boolean;
  actionLabel?: string;
}

export function LoadingModal({
  visible,
  status,
  message,
  onClose,
  autoCloseMs,
  autoCloseOn = ['success', 'error'],
  showActionButton = true,
  actionLabel = 'ตกลง',
}: LoadingModalProps) {
  const { config } = useSchoolConfig();
  const palette = getThemePalette(config.themeColor);

  const shouldAutoClose = useMemo(() => {
    return Boolean(visible && onClose && autoCloseMs && autoCloseOn.includes(status));
  }, [autoCloseMs, autoCloseOn, onClose, status, visible]);

  useEffect(() => {
    if (!shouldAutoClose) return;
    const t = setTimeout(() => onClose?.(), autoCloseMs);
    return () => clearTimeout(t);
  }, [autoCloseMs, onClose, shouldAutoClose]);

  const getIcon = () => {
    switch (status) {
      case 'loading':
        return <ActivityIndicator size="large" color={palette.primary} />;
      case 'success':
        return <IconSymbol name="checkmark.circle.fill" size={60} color="#16A34A" />;
      case 'error':
        return <IconSymbol name="xmark.circle.fill" size={60} color="#DC2626" />;
      default:
        return null;
    }
  };

  const getDefaultMessage = () => {
    switch (status) {
      case 'loading': return 'กำลังดำเนินการ...';
      case 'success': return 'ดำเนินการสำเร็จ';
      case 'error': return 'เกิดข้อผิดพลาด';
      default: return '';
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            {getIcon()}
          </View>
          
          <Text style={styles.message}>{message || getDefaultMessage()}</Text>

          {showActionButton && !shouldAutoClose && (status === 'success' || status === 'error') && onClose && (
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: status === 'success' ? '#16A34A' : '#DC2626' }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{actionLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    borderRadius: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 20,
    height: 60,
    justifyContent: 'center',
  },
  message: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1C1917',
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

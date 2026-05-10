import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props extends ViewProps {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string; // Support for NativeWind if used
}

export function ScreenContainer({ children, style, edges = ['top', 'left', 'right'], ...props }: Props) {
  const insets = useSafeAreaInsets();
  
  const paddingStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };

  return (
    <View className={`print-content ${props.className || ''}`} style={[styles.container, paddingStyle, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});

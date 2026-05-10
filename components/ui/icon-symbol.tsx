// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * SF Symbols to Material Icons mappings
 */
const MAPPING = {
  // Navigation
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "chevron.down": "expand-more",
  "chevron.up": "expand-less",
  // Attendance app
  "checkmark.circle.fill": "check-circle",
  "checkmark.circle": "check-circle-outline",
  "xmark.circle.fill": "cancel",
  "clock.fill": "schedule",
  "clock": "schedule",
  "person.3.fill": "groups",
  "person.fill": "person",
  "person": "person-outline",
  "list.bullet": "list",
  "chart.bar.fill": "bar-chart",
  "chart.bar": "bar-chart",
  "calendar": "calendar-today",
  "calendar.badge.clock": "event",
  "arrow.right.square.fill": "logout",
  "bell.fill": "notifications",
  "gear": "settings",
  "magnifyingglass": "search",
  "plus": "add",
  "minus": "remove",
  "pencil": "edit",
  "trash": "delete",
  "doc.text": "description",
  "doc.text.fill": "description",
  "graduationcap.fill": "school",
  "graduationcap": "school",
  "info.circle": "info",
  "exclamationmark.circle": "error",
  "checkmark": "check",
  "xmark": "close",
  "arrow.clockwise": "refresh",
  "square.and.arrow.up": "share",
  "printer": "print",
  "flag.fill": "flag",
  "shield.fill": "admin-panel-settings",
  "person.badge.plus": "person-add",
  "arrow.left": "arrow-back",
  "wifi.slash": "wifi-off",
  "icloud.slash": "cloud-off",
  "eye.fill": "visibility",
  "eye.slash.fill": "visibility-off",
  "lock.fill": "lock",
  "exclamationmark.circle.fill": "error",
  "key.fill": "vpn-key",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

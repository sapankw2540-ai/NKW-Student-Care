import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useSchoolConfig } from "@/lib/school-config";
import { getThemePalette } from "@/constants/theme-palettes";

export type AppAlertType = "info" | "success" | "error";

export type AppAlertAction = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "danger";
};

export type ShowAppAlertOptions = {
  title?: string;
  message: string;
  type?: AppAlertType;
  actions?: AppAlertAction[];
  autoCloseMs?: number;
  onDismiss?: () => void;
};

type AppAlertContextValue = {
  show: (options: ShowAppAlertOptions) => void;
  confirm: (options: Omit<ShowAppAlertOptions, "actions"> & { confirmLabel?: string; cancelLabel?: string; danger?: boolean }) => Promise<boolean>;
};

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

export function useAppAlert() {
  const ctx = useContext(AppAlertContext);
  if (!ctx) throw new Error("useAppAlert must be used within AppAlertProvider");
  return ctx;
}

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const { config } = useSchoolConfig();
  const palette = getThemePalette(config.themeColor);

  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string>("");
  const [type, setType] = useState<AppAlertType>("info");
  const [actions, setActions] = useState<AppAlertAction[]>([]);
  const [autoCloseMs, setAutoCloseMs] = useState<number | undefined>(undefined);
  const [onDismiss, setOnDismiss] = useState<(() => void) | undefined>(undefined);

  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const show = useCallback(
    (options: ShowAppAlertOptions) => {
      setTitle(options.title);
      setMessage(options.message);
      setType(options.type ?? "info");
      setActions(options.actions ?? []);
      setAutoCloseMs(options.autoCloseMs);
      setOnDismiss(() => options.onDismiss);
      setVisible(true);
    },
    []
  );

  const confirm = useCallback<AppAlertContextValue["confirm"]>(
    (options) => {
      return new Promise<boolean>((resolve) => {
        const cancelLabel = options.cancelLabel ?? "ยกเลิก";
        const confirmLabel = options.confirmLabel ?? "ตกลง";
        const confirmVariant: AppAlertAction["variant"] = options.danger ? "danger" : "primary";

        show({
          title: options.title,
          message: options.message,
          type: options.type ?? "info",
          autoCloseMs: options.autoCloseMs,
          actions: [
            {
              label: cancelLabel,
              variant: "secondary",
              onPress: () => {
                close();
                resolve(false);
              },
            },
            {
              label: confirmLabel,
              variant: confirmVariant,
              onPress: () => {
                close();
                resolve(true);
              },
            },
          ],
        });
      });
    },
    [close, show]
  );

  useEffect(() => {
    if (!visible || !autoCloseMs) return;
    autoCloseTimerRef.current = setTimeout(() => close(), autoCloseMs);
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    };
  }, [autoCloseMs, close, visible]);

  const icon = useMemo(() => {
    switch (type) {
      case "success":
        return <IconSymbol name="checkmark.circle.fill" size={58} color="#16A34A" />;
      case "error":
        return <IconSymbol name="xmark.circle.fill" size={58} color="#DC2626" />;
      default:
        return <IconSymbol name="info.circle.fill" size={58} color={palette.primary} />;
    }
  }, [palette.primary, type]);

  const effectiveActions = actions.length
    ? actions
    : autoCloseMs && actions.length === 0
    ? []
    : [{ label: "ตกลง", variant: "primary", onPress: close } satisfies AppAlertAction];

  const value = useMemo<AppAlertContextValue>(() => ({ show, confirm }), [confirm, show]);

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>{icon}</View>
            {!!title && <Text style={styles.title}>{title}</Text>}
            <Text style={styles.message}>{message}</Text>

            <View style={styles.actionsRow}>
              {effectiveActions.map((a, idx) => {
                const bg =
                  a.variant === "danger" ? "#DC2626" : a.variant === "secondary" ? "#E7E5E4" : palette.primary;
                const fg = a.variant === "secondary" ? "#1C1917" : "#FFFFFF";
                return (
                  <TouchableOpacity
                    key={`${a.label}_${idx}`}
                    style={[styles.button, { backgroundColor: bg }]}
                    activeOpacity={0.85}
                    onPress={() => {
                      a.onPress?.();
                      close();
                    }}
                  >
                    <Text style={[styles.buttonText, { color: fg }]}>{a.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AppAlertContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 26,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 10,
    height: 60,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    color: "#1C1917",
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    color: "#44403C",
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "800",
  },
});


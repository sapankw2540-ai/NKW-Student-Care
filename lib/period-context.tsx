import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatDateForApi } from "@/lib/thai-date";

export type Period = "morning" | "afternoon";

interface PeriodContextType {
  selectedDate: string;
  selectedPeriod: Period | null;
  setSelectedDate: (date: string) => void;
  setSelectedPeriod: (period: Period | null) => void;
  resetPeriod: () => void;
  isPageLoading: boolean;
  setIsPageLoading: (loading: boolean) => void;
}

const PeriodContext = createContext<PeriodContextType | null>(null);

const STORAGE_KEY_DATE = "global_selected_date";
const STORAGE_KEY_PERIOD = "global_selected_period";

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDateState] = useState(formatDateForApi(new Date()));
  const [selectedPeriod, setSelectedPeriodState] = useState<Period | null>(null);

  useEffect(() => {
    // Load last used date/period if needed, or just default to null period
    AsyncStorage.getItem(STORAGE_KEY_DATE).then((val) => {
      if (val) setSelectedDateState(val);
    });
    // We don't necessarily want to persist period across app restarts if the user wants to be prompted
  }, []);

  const setSelectedDate = async (date: string) => {
    setSelectedDateState(date);
    await AsyncStorage.setItem(STORAGE_KEY_DATE, date);
  };

  const setSelectedPeriod = async (period: Period | null) => {
    setSelectedPeriodState(period);
    if (period) {
      await AsyncStorage.setItem(STORAGE_KEY_PERIOD, period);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_PERIOD);
    }
  };

  const [isPageLoading, setIsPageLoading] = useState(false);

  const resetPeriod = () => {
    setSelectedPeriodState(null);
  };

  return (
    <PeriodContext.Provider value={{ 
      selectedDate, 
      selectedPeriod, 
      setSelectedDate, 
      setSelectedPeriod, 
      resetPeriod,
      isPageLoading,
      setIsPageLoading
    }}>
      {children}
    </PeriodContext.Provider>
  );
}

export function usePeriod() {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used within PeriodProvider");
  return ctx;
}

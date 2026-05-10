import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DatabaseType = 'manus' | 'supabase';

export interface DatabaseConfig {
  type: DatabaseType;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  isConfigured: boolean;
}

interface DatabaseConfigContextType {
  config: DatabaseConfig;
  setConfig: (config: DatabaseConfig) => Promise<void>;
  isLoading: boolean;
}

const DatabaseConfigContext = createContext<DatabaseConfigContextType | undefined>(undefined);

const STORAGE_KEY = 'database_config';

const DEFAULT_CONFIG: DatabaseConfig = {
  type: 'supabase',
  isConfigured: true,
};

export function DatabaseConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<DatabaseConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  // Load config from storage on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setConfigState(parsed);
        }
      } catch (error) {
        console.error('Failed to load database config:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const setConfig = async (newConfig: DatabaseConfig) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
      setConfigState(newConfig);
    } catch (error) {
      console.error('Failed to save database config:', error);
      throw error;
    }
  };

  return (
    <DatabaseConfigContext.Provider value={{ config, setConfig, isLoading }}>
      {children}
    </DatabaseConfigContext.Provider>
  );
}

export function useDatabaseConfig() {
  const context = useContext(DatabaseConfigContext);
  if (!context) {
    throw new Error('useDatabaseConfig must be used within DatabaseConfigProvider');
  }
  return context;
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpc } from './trpc';
import { useTeacherAuth } from './teacher-auth';

export interface SchoolConfig {
  schoolName: string;
  province?: string;
  semester: string;
  academicYear: string;
  version: string;
  schoolLogoUrl?: string;
  schoolIconUrl?: string;
  developerName: string; // Hardcoded in UI, but kept in type
  themeColor: 'orange' | 'blue' | 'green' | 'purple';
  lineChannelAccessToken?: string;
  lineTargetId?: string;
}

interface SchoolConfigContextType {
  config: SchoolConfig;
  setConfig: (config: SchoolConfig) => Promise<void>;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const SchoolConfigContext = createContext<SchoolConfigContextType | undefined>(undefined);

const STORAGE_KEY = 'school_config_v3';

const DEFAULT_CONFIG: SchoolConfig = {
  schoolName: 'โรงเรียนน้ำคำวิทยา',
  province: 'จังหวัดศรีสะเกษ',
  semester: '1',
  academicYear: '2569',
  version: 'v4.5.9',
  developerName: 'นายธวัชชัย แก่นจักร์ ครู โรงเรียนน้ำคำวิทยา',
  themeColor: 'orange',
  lineChannelAccessToken: '',
  lineTargetId: '',
};

export function SchoolConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfigState] = useState<SchoolConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  const utils = trpc.useUtils();
  const { data: dbConfig, isLoading: isLoadingDb } = trpc.getSchoolConfig.useQuery(undefined, {
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateDbMutation = trpc.updateSchoolConfig.useMutation({
    onSuccess: () => utils.getSchoolConfig.invalidate(),
  });

  // 1. Initial load from AsyncStorage
  useEffect(() => {
    const loadLocal = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setConfigState(prev => ({ ...prev, ...parsed }));
        }
      } catch (error) {
        console.error('Failed to load local config:', error);
      } finally {
        if (!isLoadingDb) setIsLoading(false);
      }
    };
    loadLocal();
  }, [isLoadingDb]);

  // 2. Sync with DB when data arrives
  useEffect(() => {
    if (dbConfig) {
      const mergedConfig = {
        ...config,
        schoolName: dbConfig.schoolName,
        province: dbConfig.province,
        semester: dbConfig.semester,
        academicYear: dbConfig.academicYear,
        version: dbConfig.version,
        schoolLogoUrl: dbConfig.schoolLogoUrl,
        lineChannelAccessToken: dbConfig.lineChannelAccessToken,
        lineTargetId: dbConfig.lineTargetId,
      };
      
      // Only update if changed to avoid loops
      if (JSON.stringify(mergedConfig) !== JSON.stringify(config)) {
        setConfigState(mergedConfig);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedConfig));
      }
      setIsLoading(false);
    }
  }, [dbConfig]);

  const { teacher } = useTeacherAuth();

  const setConfig = async (newConfig: SchoolConfig) => {
    try {
      // Update local state and storage
      setConfigState(newConfig);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));

      // Update Database (Global settings only for admins)
      if (teacher?.role === 'admin') {
        await updateDbMutation.mutateAsync({
          schoolName: newConfig.schoolName,
          province: newConfig.province || '',
          semester: newConfig.semester,
          academicYear: newConfig.academicYear,
          version: newConfig.version,
          schoolLogoUrl: newConfig.schoolLogoUrl,
          lineChannelAccessToken: newConfig.lineChannelAccessToken,
          lineTargetId: newConfig.lineTargetId,
        });
      }
    } catch (error) {
      console.error('Failed to sync config with DB:', error);
      if (teacher?.role === 'admin') throw error;
    }
  };

  const refetch = async () => {
    await utils.getSchoolConfig.refetch();
  };

  return (
    <SchoolConfigContext.Provider value={{ config, setConfig, isLoading: isLoading || isLoadingDb, refetch }}>
      {children}
    </SchoolConfigContext.Provider>
  );
}

export function useSchoolConfig() {
  const context = useContext(SchoolConfigContext);
  if (!context) {
    throw new Error('useSchoolConfig must be used within SchoolConfigProvider');
  }
  return context;
}

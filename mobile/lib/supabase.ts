import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

const isWeb = Platform.OS === 'web';

const DEFAULT_SUPABASE_URL = 'https://fdivyxnqodzobrlnpsvk.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkaXZ5eG5xb2R6b2JybG5wc3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTU5OTEsImV4cCI6MjA4Njc5MTk5MX0.Sy69dDRpoj7rFCMIjbdNmCcTKh0ojB4ZzOXAkoEu16s';

const ExpoSecureStoreAdapter = {
    getItem: async (key: string) => {
        if (isWeb) {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage.getItem(key);
            }
            return null;
        }
        try {
            return await SecureStore.getItemAsync(key);
        } catch (error) {
            console.warn(`[SecureStore] Failed to read key "${key}":`, error);
            return null;
        }
    },
    setItem: async (key: string, value: string) => {
        if (isWeb) {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, value);
            }
            return;
        }
        try {
            await SecureStore.setItemAsync(key, value);
        } catch (error) {
            console.warn(`[SecureStore] Failed to write key "${key}":`, error);
        }
    },
    removeItem: async (key: string) => {
        if (isWeb) {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
            return;
        }
        try {
            await SecureStore.deleteItemAsync(key);
        } catch (error) {
            console.warn(`[SecureStore] Failed to delete key "${key}":`, error);
        }
    },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: ExpoSecureStoreAdapter as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

AppState.addEventListener('change', (state) => {
    try {
        if (state === 'active') {
            supabase.auth.startAutoRefresh();
        } else {
            supabase.auth.stopAutoRefresh();
        }
    } catch (e) {
        console.warn('Supabase autoRefresh error:', e);
    }
});

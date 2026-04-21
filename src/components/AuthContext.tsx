import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Custom User type matching the Firebase User properties used throughout the app
export interface User {
    uid: string;
    email: string | null;
    displayName: string | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // On mount, check for existing token and validate it
    useEffect(() => {
        const token = api.getToken();
        if (!token) {
            setLoading(false);
            return;
        }

        api.get<User>('/auth/me')
            .then((userData) => {
                setUser(userData);
            })
            .catch(() => {
                // Token is invalid or expired
                api.clearToken();
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    // Listen for login/logout events dispatched by Login/Signup pages
    useEffect(() => {
        const handleLogin = (e: CustomEvent<User>) => {
            setUser(e.detail);
        };

        const handleLogout = () => {
            setUser(null);
        };

        window.addEventListener('auth:login', handleLogin as EventListener);
        window.addEventListener('auth:logout', handleLogout as EventListener);

        return () => {
            window.removeEventListener('auth:login', handleLogin as EventListener);
            window.removeEventListener('auth:logout', handleLogout as EventListener);
        };
    }, []);

    const logout = async () => {
        api.clearToken();
        setUser(null);
        window.dispatchEvent(new Event('auth:logout'));
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

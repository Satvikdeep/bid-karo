import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('bid_karo_token'));

    useEffect(() => {
        if (token) {
            fetchUser();
        } else {
            setLoading(false);
        }
    }, [token]);

    const fetchUser = async () => {
        try {
            const res = await api.get('/auth/me');
            setUser(res.data.user);
        } catch {
            localStorage.removeItem('bid_karo_token');
            localStorage.removeItem('bid_karo_user');
            setToken(null);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const { token: newToken, user: newUser } = res.data;
        if (newUser && typeof newUser === 'object' && !newUser.code) {
            setUser(newUser);
            localStorage.setItem('bid_karo_user', JSON.stringify(newUser));
            setToken(newToken);
            localStorage.setItem('bid_karo_token', newToken);
            return newUser;
        } else {
            console.error("Invalid user object received during login:", newUser);
            throw new Error("Invalid user data received");
        }
    };

    const register = async (data) => {
        const res = await api.post('/auth/register', data);
        const { token: newToken, user: newUser } = res.data;
        if (newUser && typeof newUser === 'object' && !newUser.code) {
            setUser(newUser);
            localStorage.setItem('bid_karo_user', JSON.stringify(newUser));
            setToken(newToken);
            localStorage.setItem('bid_karo_token', newToken);
            return newUser;
        } else {
            console.error("Invalid user object received during register:", newUser);
            throw new Error("Invalid user data received");
        }
    };

    const logout = () => {
        localStorage.removeItem('bid_karo_token');
        localStorage.removeItem('bid_karo_user');
        setToken(null);
        setUser(null);
    };

    const updateProfile = async (data) => {
        const res = await api.put('/auth/profile', data);
        const updatedUser = res.data.user;
        setUser(updatedUser);
        localStorage.setItem('bid_karo_user', JSON.stringify(updatedUser));
        return updatedUser;
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const { token } = useAuth();

    useEffect(() => {
        if (!token) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setConnected(false);
            }
            return;
        }

        // In production, we want to connect to the same origin (backend serves frontend)
        // BUT if they are separate, we need the backend URL.
        // Since we are using a proxy in dev, and Vercel rewrites in prod, window.location.origin is actually correct for Vercel
        // IF the rewrite is working.
        // However, let's be explicit to avoid issues.
        const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;
        console.log('Connecting socket to:', socketUrl);

        const newSocket = io(socketUrl, {
            auth: { token },
            transports: ['websocket', 'polling'],
            path: '/socket.io/', // Explicit path
            withCredentials: true,
        });

        newSocket.on('connect', () => {
            setConnected(true);
        });

        newSocket.on('disconnect', () => {
            setConnected(false);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [token]);

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) throw new Error('useSocket must be used within a SocketProvider');
    return context;
};

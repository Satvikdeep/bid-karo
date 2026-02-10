import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GoogleCallback = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setToken } = useAuth();

    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            localStorage.setItem('token', token);
            // trigger auth context reload
            window.location.href = '/browse';
        } else {
            navigate('/login');
        }
    }, [searchParams, navigate]);

    return (
        <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center' }}>
                <div className="spinner" />
                <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Signing you in...</p>
            </div>
        </div>
    );
};

export default GoogleCallback;

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Gavel, Mail, Lock, User, Phone, Building, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import './Auth.css';

import floralPattern from '../assets/editorial_floral_pattern.png';

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'buyer',
        hostel_name: '',
        room_number: '',
        phone: '',
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password.length < 6) {
            return toast.error('Password must be at least 6 characters');
        }
        setLoading(true);
        try {
            await register(form);
            toast.success('Account created! Welcome aboard 🎉');
            navigate('/browse');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = '/api/auth/google';
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                {/* LEFT SIDE: Image */}
                <div className="auth-brand-section">
                    <img src={floralPattern} alt="Editorial Floral Pattern" className="auth-floral-image" />
                </div>

                {/* RIGHT SIDE: Form */}
                <div className="auth-form-section">
                    <Link to="/" className="auth-logo">
                        <Gavel size={28} />
                        <span>bid<span className="auth-logo-accent">karo</span></span>
                    </Link>

                    <h1 className="auth-heading">Create account</h1>
                    <p className="auth-subheading">Start buying or selling hostel items today.</p>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <div className="input-icon-wrapper">
                                    <User size={18} className="input-icon" />
                                    <input
                                        type="text"
                                        name="name"
                                        className="form-input with-icon"
                                        placeholder="Your name"
                                        value={form.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">I want to</label>
                                <select
                                    name="role"
                                    className="form-select"
                                    value={form.role}
                                    onChange={handleChange}
                                >
                                    <option value="buyer">Buy Items</option>
                                    <option value="seller">Sell Items</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <div className="input-icon-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input
                                    type="email"
                                    name="email"
                                    className="form-input with-icon"
                                    placeholder="you@email.com"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <div className="input-icon-wrapper">
                                <Lock size={18} className="input-icon" />
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    name="password"
                                    className="form-input with-icon"
                                    placeholder="At least 6 characters"
                                    value={form.password}
                                    onChange={handleChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="input-toggle"
                                    onClick={() => setShowPass(!showPass)}
                                >
                                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Hostel Name</label>
                                <div className="input-icon-wrapper">
                                    <Building size={18} className="input-icon" />
                                    <input
                                        type="text"
                                        name="hostel_name"
                                        className="form-input with-icon"
                                        placeholder="e.g. Ashoka Hall"
                                        value={form.hostel_name}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Room No.</label>
                                <input
                                    type="text"
                                    name="room_number"
                                    className="form-input"
                                    placeholder="e.g. B-204"
                                    value={form.room_number}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Phone (optional)</label>
                            <div className="input-icon-wrapper">
                                <Phone size={18} className="input-icon" />
                                <input
                                    type="tel"
                                    name="phone"
                                    className="form-input with-icon"
                                    placeholder="+91 9876543210"
                                    value={form.phone}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <button type="submit" className="auth-submit btn-lg" disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>

                        <div className="auth-divider">
                            <span>or</span>
                        </div>

                        <button type="button" className="google-btn btn-lg" onClick={handleGoogleLogin}>
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </button>
                    </form>

                    <p className="auth-footer-text">
                        Already have an account?{' '}
                        <Link to="/login" className="auth-link">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;

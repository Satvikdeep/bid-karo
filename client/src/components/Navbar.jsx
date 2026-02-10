import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Gavel, Search, Menu, X, User, LogOut, LayoutDashboard,
    PlusCircle, ChevronDown, Shield
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import './Navbar.css';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
            setSearchQuery('');
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/');
        setProfileOpen(false);
    };

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="navbar">
            <div className="navbar-inner container">
                {/* Logo */}
                <Link to="/" className="navbar-logo">
                    <Gavel size={24} className="navbar-logo-icon" />
                    <span className="navbar-logo-text">
                        bid<span className="navbar-logo-accent">karo</span>
                    </span>
                </Link>

                {/* Search */}
                <form className="navbar-search" onSubmit={handleSearch}>
                    <Search size={18} className="navbar-search-icon" />
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="navbar-search-input"
                    />
                </form>

                {/* Navigation Links */}
                <div className={`navbar-links ${menuOpen ? 'open' : ''}`}>
                    <Link
                        to="/browse"
                        className={`navbar-link ${isActive('/browse') ? 'active' : ''}`}
                        onClick={() => setMenuOpen(false)}
                    >
                        Browse
                    </Link>

                    {user && (user.role === 'seller' || user.role === 'admin') && (
                        <Link
                            to="/sell"
                            className={`navbar-link sell-link ${isActive('/sell') ? 'active' : ''}`}
                            onClick={() => setMenuOpen(false)}
                        >
                            <PlusCircle size={16} />
                            Sell Item
                        </Link>
                    )}

                    {!user ? (
                        <div className="navbar-auth-buttons">
                            <Link to="/login" className="btn btn-ghost" onClick={() => setMenuOpen(false)}>
                                Sign In
                            </Link>
                            <Link to="/register" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                                Get Started
                            </Link>
                        </div>
                    ) : (
                        <div className="navbar-profile-wrapper">
                            <NotificationCenter />
                            <button
                                className="navbar-profile-btn"
                                onClick={() => setProfileOpen(!profileOpen)}
                            >
                                <div className="navbar-avatar">
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" />
                                    ) : (
                                        <span>{user.name?.charAt(0).toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="navbar-username">{user?.name?.split(' ')[0] || 'User'}</span>
                                <ChevronDown size={14} className={`navbar-chevron ${profileOpen ? 'open' : ''}`} />
                            </button>

                            {profileOpen && (
                                <div className="navbar-dropdown">
                                    <div className="navbar-dropdown-header">
                                        <p className="navbar-dropdown-name">{user.name}</p>
                                        <span className="badge badge-accent">{user.role}</span>
                                    </div>
                                    <div className="navbar-dropdown-divider" />

                                    <Link
                                        to="/dashboard"
                                        className="navbar-dropdown-item"
                                        onClick={() => setProfileOpen(false)}
                                    >
                                        <LayoutDashboard size={16} />
                                        Dashboard
                                    </Link>
                                    <Link
                                        to="/profile"
                                        className="navbar-dropdown-item"
                                        onClick={() => setProfileOpen(false)}
                                    >
                                        <User size={16} />
                                        Profile
                                    </Link>

                                    {user.role === 'admin' && (
                                        <Link
                                            to="/admin"
                                            className="navbar-dropdown-item"
                                            onClick={() => setProfileOpen(false)}
                                        >
                                            <Shield size={16} />
                                            Admin Panel
                                        </Link>
                                    )}

                                    <div className="navbar-dropdown-divider" />
                                    <button className="navbar-dropdown-item logout" onClick={handleLogout}>
                                        <LogOut size={16} />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Mobile toggle */}
                <button className="navbar-mobile-toggle" onClick={() => setMenuOpen(!menuOpen)}>
                    {menuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>
        </nav>
    );
};

export default Navbar;

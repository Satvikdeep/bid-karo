import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { User, Mail, Phone, Building, Save } from 'lucide-react';
import './Profile.css';

const Profile = () => {
    const { user, updateProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        hostel_name: user?.hostel_name || '',
        room_number: user?.room_number || '',
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateProfile(form);
            toast.success('Profile updated!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Update failed');
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="page">
            <div className="container">
                <div className="profile-container">
                    <div className="profile-header">
                        <div className="profile-avatar-large">
                            {user.avatar_url ? (
                                <img src={user.avatar_url} alt="" />
                            ) : (
                                <span>{user.name?.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <div>
                            <h1 className="profile-name">{user.name}</h1>
                            <p className="profile-email">{user.email}</p>
                            <span className="badge badge-accent">{user.role}</span>
                        </div>
                    </div>

                    <form className="profile-form" onSubmit={handleSubmit}>
                        <h2 className="profile-section-title">Edit Profile</h2>

                        <div className="form-group">
                            <label className="form-label">Name</label>
                            <div className="input-icon-wrapper">
                                <User size={18} className="input-icon" />
                                <input type="text" name="name" className="form-input with-icon" value={form.name} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <div className="input-icon-wrapper">
                                <Mail size={18} className="input-icon" />
                                <input type="email" className="form-input with-icon" value={user.email} disabled />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Phone</label>
                                <div className="input-icon-wrapper">
                                    <Phone size={18} className="input-icon" />
                                    <input type="tel" name="phone" className="form-input with-icon" value={form.phone} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Room Number</label>
                                <input type="text" name="room_number" className="form-input" value={form.room_number} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Hostel Name</label>
                            <div className="input-icon-wrapper">
                                <Building size={18} className="input-icon" />
                                <input type="text" name="hostel_name" className="form-input with-icon" value={form.hostel_name} onChange={handleChange} />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                            <Save size={16} />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;

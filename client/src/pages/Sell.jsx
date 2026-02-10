import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Upload, X, ImagePlus, Package } from 'lucide-react';
import './Sell.css';

const Sell = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [step, setStep] = useState(1); // 1: item info, 2: auction setup
    const [loading, setLoading] = useState(false);
    const [images, setImages] = useState([]);
    const [previews, setPreviews] = useState([]);

    const [itemForm, setItemForm] = useState({
        title: '',
        description: '',
        category_id: '',
        bought_price: '',
        buying_date: '',
        functional_condition: 'good',
        physical_condition: 'minor_wear',
    });

    const [auctionForm, setAuctionForm] = useState({
        starting_price: '',
        reserve_price: '',
        min_bid_increment: '10',
        duration_hours: '24',
    });

    useEffect(() => {
        api.get('/items/categories/all')
            .then(res => setCategories(res.data.categories || []))
            .catch(() => { });
    }, []);

    const handleImageAdd = (e) => {
        const files = Array.from(e.target.files);
        if (images.length + files.length > 6) {
            return toast.error('Maximum 6 images allowed');
        }
        setImages(prev => [...prev, ...files]);

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setPreviews(prev => [...prev, ev.target.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeImage = (index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemChange = (e) => {
        setItemForm({ ...itemForm, [e.target.name]: e.target.value });
    };

    const handleAuctionChange = (e) => {
        setAuctionForm({ ...auctionForm, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (images.length < 1) {
            return toast.error('Please add at least 1 image');
        }

        setLoading(true);
        try {
            // 1. Create item with images
            const formData = new FormData();
            Object.entries(itemForm).forEach(([key, value]) => {
                if (value) formData.append(key, value);
            });
            images.forEach(img => formData.append('images', img));

            const itemRes = await api.post('/items', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const item = itemRes.data.item;

            // 2. Create auction
            const endTime = new Date();
            endTime.setHours(endTime.getHours() + parseInt(auctionForm.duration_hours));

            await api.post('/auctions', {
                item_id: item.id,
                starting_price: auctionForm.starting_price,
                reserve_price: auctionForm.reserve_price || null,
                min_bid_increment: auctionForm.min_bid_increment,
                end_time: endTime.toISOString(),
            });

            toast.success('Item listed and auction started! 🎉');
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to create listing');
        } finally {
            setLoading(false);
        }
    };

    if (!user || (user.role !== 'seller' && user.role !== 'admin')) {
        return (
            <div className="page">
                <div className="container empty-state">
                    <p className="empty-state-text">You need a seller account to list items.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                <div className="sell-container">
                    <div className="sell-header">
                        <Package size={28} className="sell-header-icon" />
                        <div>
                            <h1 className="sell-title">List an Item</h1>
                            <p className="sell-subtitle">Create your auction in two simple steps</p>
                        </div>
                    </div>

                    {/* Progress steps */}
                    <div className="sell-steps">
                        <div className={`sell-step ${step >= 1 ? 'active' : ''}`}>
                            <div className="sell-step-num">1</div>
                            <span>Item Details</span>
                        </div>
                        <div className="sell-step-line" />
                        <div className={`sell-step ${step >= 2 ? 'active' : ''}`}>
                            <div className="sell-step-num">2</div>
                            <span>Auction Setup</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Step 1: Item info */}
                        {step === 1 && (
                            <div className="sell-form-section fade-in">
                                {/* Image Upload */}
                                <div className="form-group">
                                    <label className="form-label">Photos ({images.length}/6)</label>
                                    <div className="sell-images">
                                        {previews.map((preview, i) => (
                                            <div key={i} className="sell-image-preview">
                                                <img src={preview} alt="" />
                                                <button type="button" className="sell-image-remove" onClick={() => removeImage(i)}>
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                        {images.length < 6 && (
                                            <label className="sell-image-add">
                                                <ImagePlus size={24} />
                                                <span>Add Photo</span>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    multiple
                                                    onChange={handleImageAdd}
                                                    hidden
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input
                                        type="text"
                                        name="title"
                                        className="form-input"
                                        placeholder="e.g. Samsung Mini Fridge - 50L"
                                        value={itemForm.title}
                                        onChange={handleItemChange}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        name="description"
                                        className="form-textarea"
                                        placeholder="Describe your item — mention any defects, accessories included, etc."
                                        value={itemForm.description}
                                        onChange={handleItemChange}
                                        rows={4}
                                        required
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <select name="category_id" className="form-select" value={itemForm.category_id} onChange={handleItemChange} required>
                                            <option value="">Select category</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Original Price (₹)</label>
                                        <input
                                            type="number"
                                            name="bought_price"
                                            className="form-input"
                                            placeholder="e.g. 5000"
                                            value={itemForm.bought_price}
                                            onChange={handleItemChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Purchase Date</label>
                                        <input
                                            type="date"
                                            name="buying_date"
                                            className="form-input"
                                            value={itemForm.buying_date}
                                            onChange={handleItemChange}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Functional Condition</label>
                                        <select name="functional_condition" className="form-select" value={itemForm.functional_condition} onChange={handleItemChange}>
                                            <option value="excellent">⭐ Excellent - Works perfectly</option>
                                            <option value="good">👍 Good - Minor issues</option>
                                            <option value="fair">✋ Fair - Noticeable issues</option>
                                            <option value="poor">👎 Poor - Barely functional</option>
                                            <option value="not_working">❌ Not Working</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Physical / Visual Condition</label>
                                    <select name="physical_condition" className="form-select" value={itemForm.physical_condition} onChange={handleItemChange}>
                                        <option value="like_new">✨ Like New - No visible wear</option>
                                        <option value="minor_wear">👌 Minor Wear - Small scratches</option>
                                        <option value="visible_wear">👀 Visible Wear - Obvious signs of use</option>
                                        <option value="heavy_wear">⚠️ Heavy Wear - Significant damage</option>
                                    </select>
                                </div>

                                <div className="sell-form-actions">
                                    <button type="button" className="btn btn-primary btn-lg" onClick={() => {
                                        if (!itemForm.title || !itemForm.description || !itemForm.category_id) {
                                            return toast.error('Please fill all required fields');
                                        }
                                        if (images.length < 1) {
                                            return toast.error('Please add at least 1 image');
                                        }
                                        setStep(2);
                                    }}>
                                        Next: Auction Setup →
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Auction setup */}
                        {step === 2 && (
                            <div className="sell-form-section fade-in">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Starting Price (₹)</label>
                                        <input
                                            type="number"
                                            name="starting_price"
                                            className="form-input"
                                            placeholder="e.g. 500"
                                            value={auctionForm.starting_price}
                                            onChange={handleAuctionChange}
                                            required
                                            min="1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Reserve Price (₹, optional)</label>
                                        <input
                                            type="number"
                                            name="reserve_price"
                                            className="form-input"
                                            placeholder="Minimum acceptable price"
                                            value={auctionForm.reserve_price}
                                            onChange={handleAuctionChange}
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Min Bid Increment (₹)</label>
                                        <input
                                            type="number"
                                            name="min_bid_increment"
                                            className="form-input"
                                            value={auctionForm.min_bid_increment}
                                            onChange={handleAuctionChange}
                                            min="1"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Auction Duration</label>
                                        <select name="duration_hours" className="form-select" value={auctionForm.duration_hours} onChange={handleAuctionChange}>
                                            <option value="1">1 Hour</option>
                                            <option value="6">6 Hours</option>
                                            <option value="12">12 Hours</option>
                                            <option value="24">24 Hours</option>
                                            <option value="48">2 Days</option>
                                            <option value="72">3 Days</option>
                                            <option value="168">7 Days</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="sell-form-actions">
                                    <button type="button" className="btn btn-secondary btn-lg" onClick={() => setStep(1)}>
                                        ← Back
                                    </button>
                                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                                        <Upload size={18} />
                                        {loading ? 'Publishing...' : 'Publish Auction'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Sell;

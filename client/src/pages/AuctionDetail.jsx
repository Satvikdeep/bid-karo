import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    Clock, Users, ChevronLeft, MapPin, Calendar, Wrench, Eye as EyeIcon,
    TrendingUp, Gavel, AlertTriangle, Phone, Mail, Home as HomeIcon, X
} from 'lucide-react';
import './AuctionDetail.css';

const AuctionDetail = () => {
    const { id } = useParams();
    const { user } = useAuth();
    const { socket } = useSocket();
    const [auction, setAuction] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bidAmount, setBidAmount] = useState('');
    const [bidding, setBidding] = useState(false);
    const [selectedImage, setSelectedImage] = useState(0);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(null);
    const timerRef = useRef(null);

    const fetchAuction = useCallback(async () => {
        try {
            const res = await api.get(`/auctions/${id}`);
            setAuction(res.data.auction);
            const minBid = parseFloat(res.data.auction.current_price) + parseFloat(res.data.auction.min_bid_increment);
            setBidAmount(minBid.toFixed(0));
        } catch (err) {
            console.error('Error fetching auction:', err);
            toast.error('Auction not found');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAuction();
    }, [fetchAuction]);

    // Socket.IO real-time updates
    useEffect(() => {
        if (!socket || !id) return;

        socket.emit('join_auction', id);

        socket.on('new_bid', (data) => {
            if (data.auction_id === id) {
                setAuction(prev => ({
                    ...prev,
                    current_price: data.current_price,
                    total_bids: data.total_bids,
                    end_time: data.end_time,
                    bids: [data.bid, ...(prev?.bids || [])],
                }));
                const minBid = parseFloat(data.current_price) + parseFloat(prev => prev?.min_bid_increment || 10);
                setBidAmount(minBid.toFixed(0));
                toast.success(`New bid: ₹${parseFloat(data.current_price).toLocaleString()}`, { icon: '🔥' });
            }
        });

        socket.on('auction_ended', (data) => {
            if (data.auction_id === id) {
                setAuction(prev => ({
                    ...prev,
                    status: 'ended',
                    winner_id: data.winner_id,
                    winner_name: data.winner_name,
                }));
                toast.success('Auction has ended!', { icon: '🏆' });
            }
        });

        return () => {
            socket.emit('leave_auction', id);
            socket.off('new_bid');
            socket.off('auction_ended');
        };
    }, [socket, id]);

    // Countdown timer
    useEffect(() => {
        if (!auction?.end_time) return;

        const updateTimer = () => {
            const now = new Date();
            const end = new Date(auction.end_time);
            const diff = end - now;

            if (diff <= 0) {
                setTimeRemaining({ total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 });
                clearInterval(timerRef.current);
                return;
            }

            setTimeRemaining({
                total: diff,
                days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((diff / 1000 / 60) % 60),
                seconds: Math.floor((diff / 1000) % 60),
            });
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);

        return () => clearInterval(timerRef.current);
    }, [auction?.end_time]);

    const handleBid = async (e) => {
        e.preventDefault();
        if (!user) return toast.error('Please login to bid');
        if (user.role === 'seller' && auction.seller_id === user.id) {
            return toast.error("You can't bid on your own item");
        }

        setBidding(true);
        try {
            const res = await api.post(`/auctions/${id}/bid`, { amount: bidAmount });
            toast.success(`Bid placed: ₹${parseFloat(bidAmount).toLocaleString()}`);

            // Optimistic update
            setAuction(prev => ({
                ...prev,
                current_price: res.data.auction.current_price,
                total_bids: res.data.auction.total_bids,
                end_time: res.data.auction.end_time,
                bids: [res.data.bid, ...(prev?.bids || [])],
            }));

            const minBid = parseFloat(res.data.auction.current_price) + parseFloat(auction.min_bid_increment);
            setBidAmount(minBid.toFixed(0));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to place bid');
        } finally {
            setBidding(false);
        }
    };

    if (loading) {
        return (
            <div className="page">
                <div className="container auction-detail-skeleton">
                    <div className="skeleton" style={{ height: 400, borderRadius: 16 }} />
                    <div style={{ marginTop: 24 }}>
                        <div className="skeleton" style={{ height: 32, width: '60%', marginBottom: 12 }} />
                        <div className="skeleton" style={{ height: 20, width: '40%' }} />
                    </div>
                </div>
            </div>
        );
    }

    if (!auction) {
        return (
            <div className="page">
                <div className="container empty-state">
                    <p className="empty-state-text">Auction not found.</p>
                    <Link to="/browse" className="btn btn-primary">Browse Auctions</Link>
                </div>
            </div>
        );
    }

    const isActive = auction.status === 'active' && timeRemaining?.total > 0;
    const isEnded = auction.status === 'ended' || (timeRemaining && timeRemaining.total <= 0);
    const isWinner = user && auction.winner_id === user.id;
    const isSeller = user && auction.seller_id === user.id;
    const isUrgent = timeRemaining && timeRemaining.total > 0 && timeRemaining.total < 300000;

    return (
        <div className="page">
            <div className="container">
                <Link to="/browse" className="ad-back">
                    <ChevronLeft size={18} />
                    Back to Browse
                </Link>

                <div className="ad-layout">
                    {/* Left: Images */}
                    <div className="ad-images">
                        <div className="ad-main-image" onClick={() => setIsLightboxOpen(true)}>
                            <img
                                src={auction.images?.[selectedImage]?.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(auction.title)}&background=F5C518&color=2C2C2C&size=600`}
                                alt={auction.title}
                                onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(auction.title)}&background=F5C518&color=2C2C2C&size=600`; }}
                            />
                            {isUrgent && (
                                <div className="ad-urgent-badge">
                                    <AlertTriangle size={14} />
                                    Ending Soon!
                                </div>
                            )}
                        </div>
                        {auction.images && auction.images.length > 1 && (
                            <div className="ad-thumbnails">
                                {auction.images.map((img, i) => (
                                    <button
                                        key={img.id}
                                        className={`ad-thumbnail ${selectedImage === i ? 'active' : ''}`}
                                        onClick={() => setSelectedImage(i)}
                                    >
                                        <img src={img.image_url} alt="" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Item Details - Moved to Left Column */}
                        <div className="ad-details">
                            <h3 className="ad-details-heading">Item Details</h3>
                            <p className="ad-description">{auction.description}</p>
                            <div className="ad-specs">
                                {auction.bought_price && (
                                    <div className="ad-spec">
                                        <TrendingUp size={16} />
                                        <span className="ad-spec-label">Original Price</span>
                                        <span className="ad-spec-value">₹{parseFloat(auction.bought_price).toLocaleString()}</span>
                                    </div>
                                )}
                                {auction.buying_date && (
                                    <div className="ad-spec">
                                        <Calendar size={16} />
                                        <span className="ad-spec-label">Bought On</span>
                                        <span className="ad-spec-value">{new Date(auction.buying_date).toLocaleDateString()}</span>
                                    </div>
                                )}
                                <div className="ad-spec">
                                    <Wrench size={16} />
                                    <span className="ad-spec-label">Functional</span>
                                    <span className="ad-spec-value">{formatCondition(auction.functional_condition)}</span>
                                </div>
                                <div className="ad-spec">
                                    <EyeIcon size={16} />
                                    <span className="ad-spec-label">Physical</span>
                                    <span className="ad-spec-value">{formatPhysical(auction.physical_condition)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Image Lightbox */}
                    {isLightboxOpen && (
                        <div className="lightbox-overlay" onClick={() => setIsLightboxOpen(false)}>
                            <button className="lightbox-close">
                                <X size={32} />
                            </button>
                            <img
                                src={auction.images?.[selectedImage]?.image_url}
                                alt={auction.title}
                                className="lightbox-img"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    {/* Right: Info & Bidding */}
                    <div className="ad-info">
                        <div className="ad-status-row">
                            <span className={`badge ${isActive ? 'badge-success' : isEnded ? 'badge-dark' : 'badge-warning'}`}>
                                {isActive ? 'Live' : isEnded ? 'Ended' : auction.status}
                            </span>
                            {auction.category_name && (
                                <span className="badge badge-info">{auction.category_name}</span>
                            )}
                        </div>

                        <h1 className="ad-title">{auction.title}</h1>

                        <div className="ad-seller-row">
                            <MapPin size={14} />
                            <span>Sold by {auction.seller_name}{auction.hostel_name ? ` • ${auction.hostel_name}` : ''}</span>
                        </div>

                        {/* Price & Timer */}
                        <div className="ad-price-card">
                            <div className="ad-price-section">
                                <span className="ad-price-label">Current Bid</span>
                                <span className="ad-price-value">₹{parseFloat(auction.current_price).toLocaleString()}</span>
                                <span className="ad-price-bids">
                                    <Users size={14} /> {auction.total_bids} bid{auction.total_bids !== 1 ? 's' : ''}
                                </span>
                            </div>
                            {timeRemaining && (
                                <div className="ad-timer-section">
                                    <span className="ad-timer-label">{isEnded ? 'Auction Ended' : 'Time Remaining'}</span>
                                    {!isEnded ? (
                                        <div className={`ad-timer-blocks ${isUrgent ? 'urgent' : ''}`}>
                                            {timeRemaining.days > 0 && (
                                                <div className="ad-timer-block">
                                                    <span className="ad-timer-num">{timeRemaining.days}</span>
                                                    <span className="ad-timer-unit">days</span>
                                                </div>
                                            )}
                                            <div className="ad-timer-block">
                                                <span className="ad-timer-num">{String(timeRemaining.hours).padStart(2, '0')}</span>
                                                <span className="ad-timer-unit">hrs</span>
                                            </div>
                                            <div className="ad-timer-block">
                                                <span className="ad-timer-num">{String(timeRemaining.minutes).padStart(2, '0')}</span>
                                                <span className="ad-timer-unit">min</span>
                                            </div>
                                            <div className="ad-timer-block">
                                                <span className="ad-timer-num">{String(timeRemaining.seconds).padStart(2, '0')}</span>
                                                <span className="ad-timer-unit">sec</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="ad-timer-ended">🏆 {auction.winner_name || 'No winner'}</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Bid form */}
                        {isActive && user && !isSeller && (
                            <form className="ad-bid-form" onSubmit={handleBid}>
                                <div className="ad-bid-input-wrapper">
                                    <span className="ad-bid-currency">₹</span>
                                    <input
                                        type="number"
                                        className="ad-bid-input"
                                        value={bidAmount}
                                        onChange={(e) => setBidAmount(e.target.value)}
                                        min={parseFloat(auction.current_price) + parseFloat(auction.min_bid_increment)}
                                        step="1"
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary btn-lg ad-bid-btn" disabled={bidding}>
                                    <Gavel size={18} />
                                    {bidding ? 'Placing...' : 'Place Bid'}
                                </button>
                                <p className="ad-bid-hint">
                                    Min bid: ₹{(parseFloat(auction.current_price) + parseFloat(auction.min_bid_increment)).toLocaleString()}
                                </p>
                            </form>
                        )}

                        {isActive && !user && (
                            <Link to="/login" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 16 }}>
                                Login to Bid
                            </Link>
                        )}

                        {/* Winner contact info */}
                        {isEnded && isWinner && auction.seller_contact && (
                            <div className="ad-winner-card">
                                <h3>🎉 You won this auction!</h3>
                                <p>Contact the seller to arrange pickup:</p>
                                <div className="ad-contact-info">
                                    <div className="ad-contact-item">
                                        <Phone size={16} />
                                        <span>{auction.seller_contact.phone || 'N/A'}</span>
                                    </div>
                                    <div className="ad-contact-item">
                                        <Mail size={16} />
                                        <span>{auction.seller_contact.email}</span>
                                    </div>
                                    <div className="ad-contact-item">
                                        <HomeIcon size={16} />
                                        <span>{auction.seller_contact.hostel_name}, Room {auction.seller_contact.room_number}</span>
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* Bid History */}
                        <div className="ad-bids">
                            <h3 className="ad-details-heading">
                                Bid History ({auction.bids?.length || 0})
                            </h3>
                            {auction.bids && auction.bids.length > 0 ? (
                                <div className="ad-bid-list">
                                    {auction.bids.map((bid, i) => (
                                        <div key={bid.id || i} className={`ad-bid-item ${i === 0 ? 'highest' : ''}`}>
                                            <div className="ad-bid-item-left">
                                                <span className="ad-bidder-name">{bid.bidder_name}</span>
                                                <span className="ad-bid-time">{new Date(bid.created_at).toLocaleString()}</span>
                                            </div>
                                            <span className="ad-bid-amount">₹{parseFloat(bid.amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="ad-no-bids">No bids yet. Be the first!</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div >
    );
};

function formatCondition(c) {
    const map = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor', not_working: 'Not Working' };
    return map[c] || c;
}

function formatPhysical(c) {
    const map = { like_new: 'Like New', minor_wear: 'Minor Wear', visible_wear: 'Visible Wear', heavy_wear: 'Heavy Wear' };
    return map[c] || c;
}

export default AuctionDetail;

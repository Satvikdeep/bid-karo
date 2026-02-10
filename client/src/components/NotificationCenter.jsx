import { useState, useEffect, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import './NotificationCenter.css';

const NotificationCenter = () => {
    const { socket } = useSocket();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const dropdownRef = useRef(null);

    // Load from local storage on mount
    useEffect(() => {
        const saved = localStorage.getItem(`notifications_${user?.id}`);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setNotifications(parsed);
                    setUnreadCount(parsed.filter(n => !n.read).length);
                }
            } catch (e) {
                console.error("Failed to parse notifications", e);
                localStorage.removeItem(`notifications_${user?.id}`);
            }
        }
    }, [user?.id]);

    // Save to local storage on change
    useEffect(() => {
        if (user?.id) {
            localStorage.setItem(`notifications_${user.id}`, JSON.stringify(notifications));
        }
    }, [notifications, user?.id]);

    useEffect(() => {
        if (!socket) return;

        const handleNewBid = (data) => {
            // Only notify if looking at a different page or if it's an outbid logic (simplified here)
            // Ideally backend sends specific "outbid" event, but for now we listen to all relevant bids
            addNotification({
                id: Date.now(),
                type: 'bid',
                title: 'New Bid Activity',
                message: `New bid of ₹${parseFloat(data.current_price).toLocaleString()} on an auction you are watching.`,
                time: new Date(),
                read: false,
                link: `/auction/${data.auction_id}`
            });
        };

        const handleAuctionEnd = (data) => {
            const isWinner = data.winner_id === user?.id;
            addNotification({
                id: Date.now(),
                type: isWinner ? 'win' : 'end',
                title: isWinner ? '🎉 You Won!' : 'Auction Ended',
                message: isWinner
                    ? `Congratulations! You won the auction for ₹${parseFloat(data.final_price).toLocaleString()}.`
                    : `An auction has ended. Final price: ₹${parseFloat(data.final_price).toLocaleString()}.`,
                time: new Date(),
                read: false,
                link: `/auction/${data.auction_id}`
            });
        };

        socket.on('new_bid', handleNewBid);
        socket.on('auction_ended', handleAuctionEnd);

        return () => {
            socket.off('new_bid', handleNewBid);
            socket.off('auction_ended', handleAuctionEnd);
        };
    }, [socket, user?.id]);

    const addNotification = (note) => {
        setNotifications(prev => [note, ...prev].slice(0, 20)); // Keep last 20
        setUnreadCount(prev => prev + 1);
        toast(note.message, { icon: note.type === 'win' ? '🏆' : '🔔' });
    };

    const markAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
    };

    const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOpen = () => {
        if (!isOpen) {
            setIsOpen(true);
            markAsRead(); // Mark as read when opening
        } else {
            setIsOpen(false);
        }
    };

    const handleItemClick = (link) => {
        setIsOpen(false);
        navigate(link);
    };

    if (!user) return null;

    return (
        <div className="notification-center" ref={dropdownRef}>
            <button className="nc-bell-btn" onClick={toggleOpen}>
                <Bell size={20} />
                {unreadCount > 0 && <span className="nc-badge">{unreadCount}</span>}
            </button>

            {isOpen && (
                <div className="nc-dropdown">
                    <div className="nc-header">
                        <span className="nc-title">Notifications</span>
                        <button className="nc-close" onClick={() => setIsOpen(false)}>
                            <X size={16} />
                        </button>
                    </div>
                    <div className="nc-list">
                        {notifications.length > 0 ? (
                            notifications.map(note => (
                                <div key={note.id} className="nc-item" onClick={() => handleItemClick(note.link)}>
                                    <div className="nc-item-header">
                                        <span className="nc-item-title">{note.title}</span>
                                        <span className="nc-item-time">{new Date(note.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="nc-item-msg">{note.message}</p>
                                </div>
                            ))
                        ) : (
                            <div className="nc-empty">
                                <Check size={24} />
                                <p>All caught up!</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;

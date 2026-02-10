import { Link } from 'react-router-dom';
import { Clock, Users } from 'lucide-react';
import './AuctionCard.css';

const AuctionCard = ({ auction }) => {
    const timeRemaining = getTimeRemaining(auction.end_time);
    const isUrgent = timeRemaining.total < 3600000; // less than 1 hour

    return (
        <Link to={`/auction/${auction.id || auction.auction_id}`} className="auction-card card">
            <div className="auction-card-image">
                <img
                    src={auction.thumbnail || '/placeholder.jpg'}
                    alt={auction.title}
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(auction.title)}&background=F5C518&color=2C2C2C&size=400`; }}
                />
                {auction.auction_status === 'active' && (
                    <div className={`auction-card-timer ${isUrgent ? 'urgent' : ''}`}>
                        <Clock size={12} />
                        {timeRemaining.total > 0 ? formatTime(timeRemaining) : 'Ended'}
                    </div>
                )}
                {auction.auction_status === 'ended' && (
                    <div className="auction-card-timer ended">Sold</div>
                )}
                {auction.category_name && (
                    <div className="auction-card-category">{auction.category_name}</div>
                )}
            </div>
            <div className="auction-card-body">
                <h3 className="auction-card-title">{auction.title}</h3>
                <div className="auction-card-meta">
                    <span className="auction-card-condition">
                        {formatCondition(auction.functional_condition)}
                    </span>
                    {auction.hostel_name && (
                        <span className="auction-card-hostel">{auction.hostel_name}</span>
                    )}
                </div>
                <div className="auction-card-footer">
                    <div className="auction-card-price">
                        <span className="auction-card-price-label">Current Bid</span>
                        <span className="auction-card-price-value">₹{parseFloat(auction.current_price || auction.starting_price || 0).toLocaleString()}</span>
                    </div>
                    <div className="auction-card-bids">
                        <Users size={14} />
                        <span>{auction.total_bids || 0} bids</span>
                    </div>
                </div>
            </div>
        </Link>
    );
};

function getTimeRemaining(endTime) {
    const total = new Date(endTime) - new Date();
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const seconds = Math.floor((total / 1000) % 60);
    return { total, days, hours, minutes, seconds };
}

function formatTime({ days, hours, minutes, seconds, total }) {
    if (total <= 0) return 'Ended';
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m ${seconds}s`;
}

function formatCondition(condition) {
    const map = {
        excellent: 'Excellent',
        good: 'Good',
        fair: 'Fair',
        poor: 'Poor',
        not_working: 'Not Working',
    };
    return map[condition] || condition;
}

export default AuctionCard;

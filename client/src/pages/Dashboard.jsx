import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
    Package, Gavel, TrendingUp, Clock, CheckCircle, XCircle, Users
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
    const { user } = useAuth();
    const [myAuctions, setMyAuctions] = useState([]);
    const [myBids, setMyBids] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(user?.role === 'seller' ? 'listings' : 'bids');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const promises = [];
            if (user?.role === 'seller' || user?.role === 'admin') {
                promises.push(api.get('/auctions/user/myauctions'));
            }
            promises.push(api.get('/auctions/user/mybids'));

            const results = await Promise.all(promises);

            if (user?.role === 'seller' || user?.role === 'admin') {
                setMyAuctions(results[0]?.data?.auctions || []);
                setMyBids(results[1]?.data?.bids || []);
            } else {
                setMyBids(results[0]?.data?.bids || []);
            }
        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const activeAuctions = myAuctions.filter(a => a.status === 'active');
    const endedAuctions = myAuctions.filter(a => a.status === 'ended');
    const wonBids = myBids.filter(b => b.winner_id === user?.id && b.auction_status === 'ended');

    return (
        <div className="page">
            <div className="container">
                <div className="dash-header">
                    <h1 className="dash-title">Dashboard</h1>
                    {(user?.role === 'seller' || user?.role === 'admin') && (
                        <Link to="/sell" className="btn btn-primary">
                            <Package size={16} />
                            List New Item
                        </Link>
                    )}
                </div>

                {/* Stats */}
                <div className="dash-stats">
                    {(user?.role === 'seller' || user?.role === 'admin') && (
                        <>
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
                                    <Package size={20} />
                                </div>
                                <div>
                                    <div className="dash-stat-value">{myAuctions.length}</div>
                                    <div className="dash-stat-label">Listings</div>
                                </div>
                            </div>
                            <div className="dash-stat-card">
                                <div className="dash-stat-icon" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                                    <TrendingUp size={20} />
                                </div>
                                <div>
                                    <div className="dash-stat-value">{activeAuctions.length}</div>
                                    <div className="dash-stat-label">Active</div>
                                </div>
                            </div>
                        </>
                    )}
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
                            <Gavel size={20} />
                        </div>
                        <div>
                            <div className="dash-stat-value">{myBids.length}</div>
                            <div className="dash-stat-label">My Bids</div>
                        </div>
                    </div>
                    <div className="dash-stat-card">
                        <div className="dash-stat-icon" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <div className="dash-stat-value">{wonBids.length}</div>
                            <div className="dash-stat-label">Won</div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="dash-tabs">
                    {(user?.role === 'seller' || user?.role === 'admin') && (
                        <button className={`dash-tab ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>
                            My Listings
                        </button>
                    )}
                    <button className={`dash-tab ${tab === 'bids' ? 'active' : ''}`} onClick={() => setTab('bids')}>
                        My Bids
                    </button>
                    <button className={`dash-tab ${tab === 'won' ? 'active' : ''}`} onClick={() => setTab('won')}>
                        Won Auctions
                    </button>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="dash-loading">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12, marginBottom: 12 }} />
                        ))}
                    </div>
                ) : (
                    <div className="dash-content fade-in">
                        {tab === 'listings' && (
                            myAuctions.length > 0 ? (
                                <div className="dash-list">
                                    {myAuctions.map(auction => (
                                        <Link key={auction.id} to={`/auction/${auction.id}`} className="dash-list-item">
                                            <img
                                                src={auction.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(auction.title)}&background=F5C518&color=2C2C2C&size=120`}
                                                alt=""
                                                className="dash-list-thumb"
                                            />
                                            <div className="dash-list-info">
                                                <h3 className="dash-list-title">{auction.title}</h3>
                                                <div className="dash-list-meta">
                                                    <span className={`badge ${auction.status === 'active' ? 'badge-success' : auction.status === 'ended' ? 'badge-dark' : 'badge-warning'}`}>
                                                        {auction.status}
                                                    </span>
                                                    <span className="dash-list-bids">
                                                        <Users size={12} /> {auction.total_bids} bids
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="dash-list-price">
                                                ₹{parseFloat(auction.current_price).toLocaleString()}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p className="empty-state-text">No listings yet.</p>
                                    <Link to="/sell" className="btn btn-primary">List your first item</Link>
                                </div>
                            )
                        )}

                        {tab === 'bids' && (
                            myBids.length > 0 ? (
                                <div className="dash-list">
                                    {myBids.map((bid, i) => (
                                        <Link key={bid.id || i} to={`/auction/${bid.auction_id}`} className="dash-list-item">
                                            <img
                                                src={bid.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(bid.title)}&background=F5C518&color=2C2C2C&size=120`}
                                                alt=""
                                                className="dash-list-thumb"
                                            />
                                            <div className="dash-list-info">
                                                <h3 className="dash-list-title">{bid.title}</h3>
                                                <div className="dash-list-meta">
                                                    <span className="dash-list-bid-amount">
                                                        Your bid: ₹{parseFloat(bid.amount).toLocaleString()}
                                                    </span>
                                                    {bid.auction_status === 'ended' && bid.winner_id === user?.id && (
                                                        <span className="badge badge-success">Won!</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="dash-list-price">
                                                ₹{parseFloat(bid.current_price).toLocaleString()}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p className="empty-state-text">No bids placed yet.</p>
                                    <Link to="/browse" className="btn btn-primary">Browse Auctions</Link>
                                </div>
                            )
                        )}

                        {tab === 'won' && (
                            wonBids.length > 0 ? (
                                <div className="dash-list">
                                    {wonBids.map((bid, i) => (
                                        <Link key={bid.id || i} to={`/auction/${bid.auction_id}`} className="dash-list-item won">
                                            <img
                                                src={bid.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(bid.title)}&background=F5C518&color=2C2C2C&size=120`}
                                                alt=""
                                                className="dash-list-thumb"
                                            />
                                            <div className="dash-list-info">
                                                <h3 className="dash-list-title">{bid.title}</h3>
                                                <div className="dash-list-meta">
                                                    <span className="badge badge-accent">🏆 Winner</span>
                                                    <span>Click to see seller contact</span>
                                                </div>
                                            </div>
                                            <div className="dash-list-price">
                                                ₹{parseFloat(bid.amount).toLocaleString()}
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <p className="empty-state-text">No won auctions yet. Keep bidding!</p>
                                    <Link to="/browse" className="btn btn-primary">Browse Auctions</Link>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;

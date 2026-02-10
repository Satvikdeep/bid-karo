import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';
import './Home.css';

const Home = () => {
    const [featuredAuctions, setFeaturedAuctions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [auctionsRes, catsRes] = await Promise.all([
                    api.get('/auctions?status=active&limit=6&sort=ending_soon'),
                    api.get('/items/categories/all'),
                ]);
                setFeaturedAuctions(auctionsRes.data.auctions || []);
                setCategories(catsRes.data.categories || []);
            } catch (err) {
                console.error('Error fetching home data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    return (
        <div className="home-page">
            {/* ── Masthead ── */}
            <header className="masthead">
                <div className="container masthead-inner">
                    <div className="masthead-left">
                        <p className="masthead-date">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </p>
                    </div>
                    <div className="masthead-center">
                        <h1 className="masthead-title">Bid Karo</h1>
                        <p className="masthead-tagline">The Hostel Marketplace</p>
                    </div>
                    <div className="masthead-right">
                        <Link to="/browse" className="masthead-nav">
                            Browse <ArrowRight size={12} />
                        </Link>
                        <Link to="/register" className="masthead-nav">
                            Sell <ArrowRight size={12} />
                        </Link>
                    </div>
                </div>
            </header>

            {/* ── Headline ── */}
            <section className="headline">
                <div className="container">
                    <h2 className="headline-text">
                        Auction what you leave behind.
                    </h2>
                    <p className="headline-deck">
                        A simple, real-time auction platform for hostel residents.
                        List items you no longer need — mattresses, chairs,
                        fridges — and let fellow students bid on them.
                    </p>
                </div>
            </section>

            {/* ── Metrics bar ── */}
            <section className="metrics-bar">
                <div className="container metrics-grid">
                    <div className="metric-cell">
                        <span className="metric-val">Real-Time</span>
                        <span className="metric-lbl">Bidding via WebSocket</span>
                    </div>
                    <div className="metric-cell">
                        <span className="metric-val">Secure</span>
                        <span className="metric-lbl">JWT Authentication</span>
                    </div>
                    <div className="metric-cell">
                        <span className="metric-val">Fair</span>
                        <span className="metric-lbl">Anti-Sniping Timer</span>
                    </div>
                </div>
            </section>

            {/* ── Categories ── */}
            {categories.length > 0 && (
                <section className="paper-section">
                    <div className="container">
                        <div className="section-row">
                            <h3 className="section-hed">Categories</h3>
                            <Link to="/browse" className="section-more">
                                View all <ArrowRight size={11} />
                            </Link>
                        </div>
                        <div className="cat-strip">
                            {categories.map((cat) => (
                                <Link
                                    key={cat.id}
                                    to={`/browse?category=${cat.slug}`}
                                    className="cat-chip"
                                >
                                    <span className="cat-ico">{cat.icon}</span>
                                    <span>{cat.name}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* ── Live Auctions ── */}
            <section className="paper-section">
                <div className="container">
                    <div className="section-row">
                        <h3 className="section-hed">Live Auctions</h3>
                        <Link to="/browse" className="section-more">
                            View all <ArrowRight size={11} />
                        </Link>
                    </div>
                    {loading ? (
                        <div className="auction-grid">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="skeleton-card">
                                    <div className="skeleton" style={{ height: 160 }} />
                                    <div style={{ padding: 16 }}>
                                        <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
                                        <div className="skeleton" style={{ height: 10, width: '45%' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : featuredAuctions.length > 0 ? (
                        <div className="auction-grid">
                            {featuredAuctions.map((auction) => (
                                <AuctionCard key={auction.id} auction={auction} />
                            ))}
                        </div>
                    ) : (
                        <div className="empty-col">
                            <p>No active auctions right now.</p>
                            <Link to="/sell" className="section-more" style={{ marginTop: 8 }}>
                                Be the first to list <ArrowRight size={11} />
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* ── How It Works ── */}
            <section className="paper-section">
                <div className="container">
                    <h3 className="section-hed">How It Works</h3>
                    <div className="steps-grid">
                        <div className="steps-cell">
                            <span className="step-no">01</span>
                            <h4>Create an account</h4>
                            <p>Sign up as a buyer or seller with your hostel details.</p>
                        </div>
                        <div className="steps-cell">
                            <span className="step-no">02</span>
                            <h4>List or browse</h4>
                            <p>Post items you&apos;re leaving behind, or find what you need.</p>
                        </div>
                        <div className="steps-cell">
                            <span className="step-no">03</span>
                            <h4>Bid in real-time</h4>
                            <p>Place live bids — updates are instant via WebSocket.</p>
                        </div>
                        <div className="steps-cell">
                            <span className="step-no">04</span>
                            <h4>Win &amp; collect</h4>
                            <p>Winner sees seller contact. Meet up and close the deal.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Footer CTA ── */}
            <footer className="paper-footer">
                <div className="container footer-row">
                    <p className="footer-text">
                        Ready to list your stuff? It takes two minutes.
                    </p>
                    <Link to="/register" className="section-more">
                        Get Started <ArrowRight size={11} />
                    </Link>
                </div>
            </footer>
        </div>
    );
};

export default Home;

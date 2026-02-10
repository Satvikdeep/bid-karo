import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import api from '../services/api';
import AuctionCard from '../components/AuctionCard';
import './Browse.css';

const Browse = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [auctions, setAuctions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({});
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        category: searchParams.get('category') || '',
        sort: searchParams.get('sort') || 'ending_soon',
        status: 'active',
        page: 1,
    });

    useEffect(() => {
        api.get('/items/categories/all').then(res => setCategories(res.data.categories || [])).catch(() => { });
    }, []);

    useEffect(() => {
        fetchAuctions();
    }, [filters]);

    const fetchAuctions = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.search) params.set('search', filters.search);
            if (filters.category) params.set('category', filters.category);
            params.set('sort', filters.sort);
            params.set('status', filters.status);
            params.set('page', filters.page);
            params.set('limit', 12);

            // Update URL params
            setSearchParams(params);

            const res = await api.get(`/auctions?${params.toString()}`);
            setAuctions(res.data.auctions || []);
            setPagination(res.data.pagination || {});
        } catch (err) {
            console.error('Error fetching auctions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
    };

    const clearFilters = () => {
        setFilters({ search: '', category: '', sort: 'ending_soon', status: 'active', page: 1 });
    };

    const hasActiveFilters = filters.search || filters.category;

    return (
        <div className="page">
            <div className="container">
                {/* Page Header */}
                <div className="browse-header">
                    <div>
                        <h1 className="browse-title">Browse Auctions</h1>
                        <p className="browse-subtitle">
                            {pagination.total || 0} items available
                        </p>
                    </div>
                </div>

                {/* Search & Filters Bar */}
                <div className="browse-controls">
                    <div className="browse-search-wrapper">
                        <Search size={18} className="browse-search-icon" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            className="browse-search"
                            value={filters.search}
                            onChange={(e) => handleFilterChange('search', e.target.value)}
                        />
                        {filters.search && (
                            <button className="browse-search-clear" onClick={() => handleFilterChange('search', '')}>
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="browse-filter-actions">
                        <select
                            className="form-select browse-sort"
                            value={filters.sort}
                            onChange={(e) => handleFilterChange('sort', e.target.value)}
                        >
                            <option value="ending_soon">Ending Soon</option>
                            <option value="newest">Newest</option>
                            <option value="price_low">Price: Low to High</option>
                            <option value="price_high">Price: High to Low</option>
                            <option value="most_bids">Most Bids</option>
                        </select>

                        <select
                            className="form-select browse-sort"
                            value={filters.status}
                            onChange={(e) => handleFilterChange('status', e.target.value)}
                        >
                            <option value="active">Active</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="ended">Ended</option>
                            <option value="active,upcoming">Active & Upcoming</option>
                        </select>

                        <button
                            className={`btn btn-secondary browse-filter-toggle ${filtersOpen ? 'active' : ''}`}
                            onClick={() => setFiltersOpen(!filtersOpen)}
                        >
                            <SlidersHorizontal size={16} />
                            Filters
                        </button>
                    </div>
                </div>

                {/* Category Chips */}
                {filtersOpen && (
                    <div className="browse-filters-panel fade-in">
                        <div className="browse-filter-section">
                            <span className="browse-filter-label">Category</span>
                            <div className="browse-chips">
                                <button
                                    className={`browse-chip ${!filters.category ? 'active' : ''}`}
                                    onClick={() => handleFilterChange('category', '')}
                                >
                                    All
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat.id}
                                        className={`browse-chip ${filters.category === cat.slug ? 'active' : ''}`}
                                        onClick={() => handleFilterChange('category', filters.category === cat.slug ? '' : cat.slug)}
                                    >
                                        {cat.icon} {cat.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {hasActiveFilters && (
                            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                                Clear all filters
                            </button>
                        )}
                    </div>
                )}

                {/* Results */}
                {loading ? (
                    <div className="auction-grid">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="card" style={{ minHeight: 280 }}>
                                <div className="skeleton" style={{ height: 160, borderRadius: 0 }} />
                                <div style={{ padding: 16 }}>
                                    <div className="skeleton" style={{ height: 20, width: '80%', marginBottom: 8 }} />
                                    <div className="skeleton" style={{ height: 14, width: '50%' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : auctions.length > 0 ? (
                    <>
                        <div className="auction-grid">
                            {auctions.map(auction => (
                                <AuctionCard key={auction.id} auction={auction} />
                            ))}
                        </div>

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                            <div className="browse-pagination">
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={filters.page <= 1}
                                    onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                                >
                                    Previous
                                </button>
                                <span className="browse-page-info">
                                    Page {pagination.page} of {pagination.pages}
                                </span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    disabled={filters.page >= pagination.pages}
                                    onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="empty-state">
                        <p className="empty-state-text">No auctions found matching your criteria.</p>
                        {hasActiveFilters && (
                            <button className="btn btn-secondary" onClick={clearFilters}>
                                Clear Filters
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Browse;

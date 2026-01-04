import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Layers, Search, Star, ChevronDown } from 'lucide-react';

declare global {
    interface Window {
        TradingView: any;
    }
}

interface Asset {
    symbol: string;
    name: string;
    price: number;
    change24h: number;
    isFavorite?: boolean;
}

// Mock data based on Velo's real assets list observed in exploration
const INITIAL_ASSETS: Asset[] = [
    { symbol: 'BTC', name: 'Bitcoin', price: 87740.1, change24h: -0.68, isFavorite: true },
    { symbol: 'ETH', name: 'Ethereum', price: 2978.35, change24h: 0.48, isFavorite: true },
    { symbol: 'SOL', name: 'Solana', price: 124.95, change24h: 0.22, isFavorite: true },
    { symbol: 'XRP', name: 'Ripple', price: 1.8407, change24h: -1.71 },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.1177, change24h: -4.18 },
    { symbol: 'BNB', name: 'Binance Coin', price: 865.47, change24h: 0.47 },
    { symbol: 'SUI', name: 'Sui', price: 1.4081, change24h: -1.45 },
    { symbol: 'PEPE', name: 'Pepe', price: 0.0000185, change24h: 2.31 },
    { symbol: 'HYPE', name: 'Hyperliquid', price: 25.51, change24h: -1.31 },
    { symbol: 'XPL', name: 'X-Player', price: 0.162, change24h: -1.04 },
    { symbol: 'ADA', name: 'Cardano', price: 0.3339, change24h: -4.44 },
    { symbol: 'ZEC', name: 'Zcash', price: 511.12, change24h: -2.90 },
    { symbol: 'WIF', name: 'dogwifhat', price: 2.14, change24h: 3.51 },
    { symbol: 'TAO', name: 'Bittensor', price: 432.11, change24h: -0.92 },
    { symbol: 'NEAR', name: 'Near Protocol', price: 4.87, change24h: 1.15 },
    { symbol: 'FET', name: 'Artificial Superintelligence', price: 1.34, change24h: -2.05 }
];

export default function VeloPage() {
    const navigate = useNavigate();
    const [isLoaded, setIsLoaded] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [favoritesOnly, setFavoritesOnly] = useState(false);
    const [assets, setAssets] = useState<Asset[]>(INITIAL_ASSETS);
    const [tvWidget, setTvWidget] = useState<any>(null);

    useEffect(() => {
        // Check if script already exists
        if (document.getElementById('tradingview-advanced-script')) {
            setIsLoaded(true);
            return;
        }

        const script = document.createElement('script');
        script.id = 'tradingview-advanced-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => setIsLoaded(true);
        document.head.appendChild(script);
    }, []);

    useEffect(() => {
        if (!isLoaded || !window.TradingView) return;

        const widget = new window.TradingView.widget({
            "autosize": true,
            "symbol": "BINANCE:BTCUSDT",
            "interval": "60",
            "timezone": "Etc/UTC",
            "theme": "dark",
            "style": "1",
            "locale": "en",
            "toolbar_bg": "#0D0D0D",
            "enable_publishing": false,
            "hide_side_toolbar": false,
            "allow_symbol_change": true,
            "container_id": "velo_chart_container",
            "library_path": "/charting_library/",
            "drawings_access": { type: 'black', tools: [{ name: "Regression Trend" }] },
            "enabled_features": [
                "side_toolbar_in_fullscreen_mode",
                "header_in_fullscreen_mode",
                "header_symbol_search",
                "header_resolutions",
                "header_indicators",
                "header_settings",
                "header_screenshot",
                "header_fullscreen_button",
                "header_saveload"
            ],
            "disabled_features": [
                "display_market_status",
                "symbol_info"
            ],
            "overrides": {
                "paneProperties.background": "#0d0d0d",
                "paneProperties.backgroundType": "solid",
                "paneProperties.vertGridProperties.color": "rgba(42, 46, 57, 0)",
                "paneProperties.horzGridProperties.color": "rgba(42, 46, 57, 0)",
                "symbolWatermarkProperties.transparency": 90,
                "scalesProperties.lineColor": "rgba(42, 46, 57, 0.5)",
                "scalesProperties.textColor": "#D1D4DC",
                "mainSeriesProperties.candleStyle.upColor": "#00C805",
                "mainSeriesProperties.candleStyle.downColor": "#FA5000",
                "mainSeriesProperties.candleStyle.drawWick": true,
                "mainSeriesProperties.candleStyle.drawBorder": true,
                "mainSeriesProperties.candleStyle.borderColor": "#378658",
                "mainSeriesProperties.candleStyle.borderUpColor": "#00C805",
                "mainSeriesProperties.candleStyle.borderDownColor": "#FA5000",
                "mainSeriesProperties.candleStyle.wickUpColor": "#00C805",
                "mainSeriesProperties.candleStyle.wickDownColor": "#FA5000",
                "mainSeriesProperties.showCountdown": false
            },
            "loading_screen": { backgroundColor: "#0d0d0d", foregroundColor: "#2962ff" }
        });

        setTvWidget(widget);
    }, [isLoaded]);

    const filteredAssets = useMemo(() => {
        return assets.filter(asset => {
            const matchesSearch = asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFavorite = favoritesOnly ? asset.isFavorite : true;
            return matchesSearch && matchesFavorite;
        });
    }, [assets, searchQuery, favoritesOnly]);

    const handleSelectAsset = (symbol: string) => {
        if (tvWidget && tvWidget.chart) {
            tvWidget.chart().setSymbol(`BINANCE:${symbol}USDT`);
        }
    };

    const toggleFavorite = (e: React.MouseEvent, symbol: string) => {
        e.stopPropagation();
        setAssets(prev => prev.map(a =>
            a.symbol === symbol ? { ...a, isFavorite: !a.isFavorite } : a
        ));
    };

    return (
        <div className="velo-full-container">
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
        
        .velo-full-container {
          width: 100vw;
          height: 100vh;
          background-color: #0d0d0d;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Outfit', sans-serif;
          color: #d1d4dc;
        }

        /* Minimal Header */
        .velo-minimal-header {
          height: 48px;
          display: flex;
          align-items: center;
          padding: 0 16px;
          background-color: #0d0d0d;
          border-bottom: 1px solid #1e222d;
          z-index: 100;
        }

        .velo-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          color: white;
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.5px;
        }

        .logo-icon {
          color: #2962ff;
        }

        /* Layout Main */
        .velo-main-layout {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        #velo_chart_container {
          flex: 1;
          height: 100%;
        }

        /* Right Watchlist Sidebar */
        .velo-right-sidebar {
          width: 300px;
          background-color: #0d0d0d;
          border-left: 1px solid #1e222d;
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .sidebar-header {
          padding: 12px;
          border-bottom: 1px solid #1e222d;
        }

        .filter-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          font-size: 11px;
          color: #787b86;
        }

        .fav-switch-container {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          user-select: none;
        }

        .custom-checkbox {
          width: 14px;
          height: 14px;
          border: 1px solid #363a45;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #131722;
        }

        .custom-checkbox.active {
          background: #2962ff;
          border-color: #2962ff;
        }

        .search-bar-wrapper {
          position: relative;
          background: #131722;
          border: 1px solid #2a2e39;
          border-radius: 6px;
          padding: 4px 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .search-bar-wrapper input {
          background: transparent;
          border: none;
          color: white;
          font-size: 13px;
          outline: none;
          width: 100%;
        }

        .sidebar-content {
          flex: 1;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #2a2e39 transparent;
        }

        .sidebar-content::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar-content::-webkit-scrollbar-thumb {
          background: #2a2e39;
          border-radius: 2px;
        }

        .asset-row {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid rgba(30, 34, 45, 0.3);
        }

        .asset-row:hover {
          background: #1e222d;
        }

        .asset-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }

        .asset-icon-placeholder {
          width: 20px;
          height: 20px;
          background: #2a2e39;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: #787b86;
          font-weight: bold;
        }

        .asset-symbol-label {
          font-weight: 600;
          color: white;
        }

        .asset-right {
          text-align: right;
        }

        .asset-price-val {
          font-weight: 500;
          display: block;
        }

        .asset-change-val {
          font-size: 11px;
          font-weight: 600;
        }

        .positive { color: #00c805; }
        .negative { color: #fa5000; }

        .fav-btn {
          color: #363a45;
          transition: transform 0.1s;
        }

        .fav-btn:hover { transform: scale(1.2); }
        .fav-btn.active { color: #fcc419; }

        .col-labels {
          display: flex;
          justify-content: flex-end;
          padding: 6px 12px;
          font-size: 10px;
          color: #787b86;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .col-labels span {
          width: 70px;
          text-align: right;
        }
      `}</style>

            <header className="velo-minimal-header">
                <div className="velo-logo" onClick={() => navigate('/dashboard')}>
                    <Layers className="logo-icon" size={22} />
                    <span>VELO</span>
                </div>
            </header>

            <div className="velo-main-layout">
                <div id="velo_chart_container" />

                <aside className="velo-right-sidebar">
                    <div className="sidebar-header">
                        <div className="filter-row">
                            <div
                                className="fav-switch-container"
                                onClick={() => setFavoritesOnly(!favoritesOnly)}
                            >
                                <div className={`custom-checkbox ${favoritesOnly ? 'active' : ''}`}>
                                    {favoritesOnly && <div style={{ width: 6, height: 6, background: 'white', borderRadius: 1 }} />}
                                </div>
                                <span>Favorites only</span>
                            </div>
                            <div className="flex items-center gap-1 cursor-pointer">
                                <span>All Exchanges</span>
                                <ChevronDown size={10} />
                            </div>
                        </div>

                        <div className="search-bar-wrapper">
                            <Search size={14} color="#787b86" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="col-labels">
                        <span>Price</span>
                        <span>24h Chg</span>
                    </div>

                    <div className="sidebar-content">
                        {filteredAssets.map(asset => (
                            <div
                                key={asset.symbol}
                                className="asset-row"
                                onClick={() => handleSelectAsset(asset.symbol)}
                            >
                                <div className="asset-left">
                                    <Star
                                        size={14}
                                        className={`fav-btn ${asset.isFavorite ? 'active' : ''}`}
                                        fill={asset.isFavorite ? 'currentColor' : 'none'}
                                        onClick={(e) => toggleFavorite(e, asset.symbol)}
                                    />
                                    <div className="asset-icon-placeholder">
                                        {asset.symbol.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="asset-symbol-label">{asset.symbol}</div>
                                        <div style={{ fontSize: 10, color: '#787b86' }}>{asset.name}</div>
                                    </div>
                                </div>
                                <div className="asset-right">
                                    <span className="asset-price-val">
                                        {asset.price.toLocaleString(undefined, { minimumFractionDigits: asset.price < 1 ? 4 : 2 })}
                                    </span>
                                    <span className={`asset-change-val ${asset.change24h >= 0 ? 'positive' : 'negative'}`}>
                                        {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}

import { useState, useEffect, useCallback } from 'react';

export interface TournamentStats {
    totalBalance: number;
    realized: number;
    unrealized: number;
    rank: number;
    maxDrawdown: number;
    totalFees: number;
    winRate: number;
    totalTrades: number;
}

export interface PracticeSettings {
    symbol: string;
    timeLimit: number;
    initialBalance: number;
    maxDrawdownPercent: number | null;
}

const DEFAULT_STATS: TournamentStats = {
    totalBalance: 100000,
    realized: 0,
    unrealized: 0,
    rank: 4,
    maxDrawdown: 0,
    totalFees: 0,
    winRate: 0,
    totalTrades: 0,
};

export interface MatchData {
    id?: string;
    player1_id?: string;
    player2_id?: string;
    player1_pnl?: number;
    player2_pnl?: number;
    player1_balance?: number;
    player2_balance?: number;
    player1_trades?: number;
    player2_trades?: number;
    player1_win_rate?: number;
    player2_win_rate?: number;
    player1_elo_change?: number;
    player2_elo_change?: number;
    winner_id?: string;
    [key: string]: unknown;
}

export function useCompetitionGame(
    gameMode: 'speed' | 'survival' | 'tournament',
    _matchId: string | null,
    matchData: MatchData | null,
    onGameOver?: () => void
) {
    const [gameStarted, setGameStarted] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [isLiquidated, setIsLiquidated] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300);
    const [tournamentStats, setTournamentStats] = useState<TournamentStats>(DEFAULT_STATS);
    const [maxDrawdownLimit, setMaxDrawdownLimit] = useState<number | null>(5000);

    // Game Timer
    useEffect(() => {
        if (!gameStarted || gameOver) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    setGameOver(true);
                    if (onGameOver) onGameOver();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [gameStarted, gameOver, onGameOver]);

    const startGame = useCallback((settings?: PracticeSettings) => {
        const defaultTimeLimit = gameMode === 'speed' ? 300 : 900;
        const timeLimit = (typeof matchData?.time_limit === 'number' ? matchData.time_limit : defaultTimeLimit);
        setTimeLeft(settings?.timeLimit ? settings.timeLimit * 60 : timeLimit);
        
        if (settings) {
            setTournamentStats(prev => ({
                ...prev,
                totalBalance: settings.initialBalance
            }));
            
            // Set max drawdown limit (null means no limit)
            if (settings.maxDrawdownPercent === null) {
                setMaxDrawdownLimit(null); // No limit - disable liquidation check
            } else {
                setMaxDrawdownLimit(settings.initialBalance * (settings.maxDrawdownPercent / 100));
            }
        } else {
            setMaxDrawdownLimit(5000); // Default
        }

        setGameStarted(true);
        setGameOver(false);
        setIsLiquidated(false);
    }, [gameMode, matchData]);

    const resetGame = useCallback(() => {
        setGameStarted(false);
        setGameOver(false);
        setIsLiquidated(false);
        setTimeLeft(gameMode === 'speed' ? 300 : 900);
        setTournamentStats(DEFAULT_STATS);
        setMaxDrawdownLimit(5000);
    }, [gameMode]);

    const handleLiquidation = useCallback(() => {
        setIsLiquidated(true);
        setGameOver(true);
        if (onGameOver) onGameOver();
    }, [onGameOver]);

    const updateStats = useCallback((updates: Partial<TournamentStats>) => {
        setTournamentStats(prev => ({ ...prev, ...updates }));
    }, []);

    return {
        gameStarted,
        gameOver,
        isLiquidated,
        timeLeft,
        tournamentStats,
        maxDrawdownLimit,
        startGame,
        resetGame,
        handleLiquidation,
        updateStats,
        setGameOver,
        setGameStarted,
    };
}


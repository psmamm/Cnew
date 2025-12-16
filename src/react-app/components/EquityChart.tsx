import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { useTrades } from '@/react-app/hooks/useTrades';
import { useUserEquity } from '@/react-app/hooks/useUserEquity';

export default function EquityChart() {
  const { trades } = useTrades();
  const { equity } = useUserEquity();
  
  const chartData = useMemo(() => {
    // Generate equity curve data based on trades and user starting capital
    const data = [];
    let runningPnl = equity.startingCapital; // Use actual starting capital
    
    // Sort trades by date
    const sortedTrades = [...trades]
      .filter(t => t.is_closed)
      .sort((a, b) => new Date(a.exit_date || a.entry_date).getTime() - new Date(b.exit_date || b.entry_date).getTime());
    
    // If no trades, show a flat line
    if (sortedTrades.length === 0) {
      const today = new Date();
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: runningPnl
        });
      }
      return data;
    }
    
    // Start from 30 days ago
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 29);
    
    let tradeIndex = 0;
    
    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Add any trades that happened on this day
      while (tradeIndex < sortedTrades.length) {
        const trade = sortedTrades[tradeIndex];
        const tradeDate = (trade.exit_date || trade.entry_date);
        
        if (tradeDate <= dateStr) {
          runningPnl += trade.pnl || 0;
          tradeIndex++;
        } else {
          break;
        }
      }
      
      data.push({
        date: currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: runningPnl
      });
    }
    
    return data;
  }, [trades, equity.startingCapital]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1E2232] border border-white/10 rounded-lg p-3 shadow-lg">
          <p className="text-[#7F8C8D] text-sm mb-1">{label}</p>
          <p className="text-white font-semibold">
            ${payload[0].value.toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis 
            dataKey="date" 
            stroke="#7F8C8D" 
            fontSize={12}
            tick={{ fill: '#7F8C8D' }}
          />
          <YAxis 
            stroke="#7F8C8D" 
            fontSize={12}
            tick={{ fill: '#7F8C8D' }}
            tickFormatter={(value) => `$${value.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#6A3DF4" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: '#6A3DF4', strokeWidth: 2, fill: '#6A3DF4' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

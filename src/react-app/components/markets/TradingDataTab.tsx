import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';

export default function TradingDataTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-[#1E2232] rounded-2xl p-6 border border-white/5">
        <h2 className="text-xl font-bold text-white mb-4">Trading Data</h2>
        <p className="text-[#7F8C8D] mb-6">
          Advanced trading data and analytics will be displayed here.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="w-4 h-4 text-[#6A3DF4]" />
              <span className="text-[#7F8C8D] text-sm">Total Volume</span>
            </div>
            <div className="text-xl font-bold text-white">—</div>
          </div>

          <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-[#2ECC71]" />
              <span className="text-[#7F8C8D] text-sm">24h High</span>
            </div>
            <div className="text-xl font-bold text-white">—</div>
          </div>

          <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingDown className="w-4 h-4 text-[#E74C3C]" />
              <span className="text-[#7F8C8D] text-sm">24h Low</span>
            </div>
            <div className="text-xl font-bold text-white">—</div>
          </div>

          <div className="bg-[#0D0F18]/50 rounded-xl p-4 border border-white/10">
            <div className="flex items-center space-x-2 mb-2">
              <Activity className="w-4 h-4 text-[#3498DB]" />
              <span className="text-[#7F8C8D] text-sm">Active Pairs</span>
            </div>
            <div className="text-xl font-bold text-white">—</div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-[#0D0F18]/30 rounded-xl border border-white/10">
          <p className="text-sm text-[#7F8C8D]">
            Historical charts, order book visualization, trade history, and volume analyses will be implemented here.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

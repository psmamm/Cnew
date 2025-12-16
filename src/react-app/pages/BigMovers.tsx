import DashboardLayout from "@/react-app/components/DashboardLayout";
import BigMovers from "@/react-app/components/BigMovers";
import { motion } from "framer-motion";

export default function BigMoversPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Big Movers Component */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <BigMovers />
        </motion.div>

        {/* Crypto Bubbles Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-white/5"
        >
          <div className="w-full h-[800px] bg-[#131722] overflow-hidden">
            <iframe
              src="https://cryptobubbles.net"
              className="w-full h-full border-0 overflow-hidden"
              title="Crypto Bubbles"
              loading="lazy"
              scrolling="no"
              style={{ background: '#131722', overflow: 'hidden' }}
            />
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}

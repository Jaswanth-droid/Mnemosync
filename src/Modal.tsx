import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gray-900/90 backdrop-filter backdrop-blur-xl border border-border rounded-xl shadow-xl max-w-md w-full mx-4 p-4"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
        >
          <div className="flex justify-between items-center mb-3">
            {title && <h2 className="text-lg font-bold text-white">{title}</h2>}
            <button
              onClick={onClose}
              className="text-dim hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="overflow-y-auto max-h-[70vh]">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

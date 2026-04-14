import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Cat, Coffee, Heart, Utensils } from 'lucide-react';

interface CatEntity {
  id: number;
  name: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  state: 'walking' | 'idle' | 'eating' | 'happy';
  color: string;
  flip: boolean;
  timer: number;
}

interface CatCafeGameProps {
  onScoreUpdate?: (score: number) => void;
  isSecretUnlocked?: boolean;
}

export default function CatCafeGame({ onScoreUpdate, isSecretUnlocked }: CatCafeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    onScoreUpdate?.(score);
  }, [score, onScoreUpdate]);
  const [cats, setCats] = useState<CatEntity[]>([]);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef<number>(null);

  const catColors = [
    '#4E342E', // Darker Brown (Cookie)
    '#795548', // Medium Brown (Mochi)
    '#A1887F', // Visible Brown (Coco)
    '#D7CCC8', // Light Beige (Latte)
    '#8D6E63', // Soft Brown (Biscuit)
    '#BCAAA4'  // Muted Beige (Brownie)
  ];

  const catNames = ['Cookie', 'Mochi', 'Coco', 'Latte', 'Biscuit', 'Brownie', 'Toffee', 'Muffin'];

  useEffect(() => {
    const initialCats: CatEntity[] = Array.from({ length: 5 }).map((_, i) => ({
      id: i,
      name: catNames[i % catNames.length],
      x: Math.random() * 300,
      y: Math.random() * 200,
      targetX: Math.random() * 300,
      targetY: Math.random() * 200,
      state: 'walking',
      color: catColors[i % catColors.length],
      flip: false,
      timer: 0
    }));
    setCats(initialCats);
  }, []);

  const update = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;

      setCats(prevCats => prevCats.map(cat => {
        let { x, y, targetX, targetY, state, timer, flip } = cat;

        if (state === 'walking') {
          const dx = targetX - x;
          const dy = targetY - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 2) {
            state = 'idle';
            timer = 1000 + Math.random() * 2000;
          } else {
            const speed = 0.05 * deltaTime;
            x += (dx / dist) * speed;
            y += (dy / dist) * speed;
            flip = dx < 0;
          }
        } else if (state === 'idle') {
          timer -= deltaTime;
          if (timer <= 0) {
            state = 'walking';
            targetX = 20 + Math.random() * 260; // Keep away from edges
            targetY = 20 + Math.random() * 160;
          }
        } else if (state === 'eating' || state === 'happy') {
          timer -= deltaTime;
          if (timer <= 0) {
            state = 'idle';
            timer = 1000;
          }
        }

        // Strict boundary checks
        x = Math.max(10, Math.min(280, x));
        y = Math.max(10, Math.min(180, y));

        return { ...cat, x, y, targetX, targetY, state, timer, flip };
      }));
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(update);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current!);
  }, []);

  const handleAction = (type: 'feed' | 'pet') => {
    setCats(prevCats => {
      const newCats = [...prevCats];
      const randomIndex = Math.floor(Math.random() * newCats.length);
      const cat = newCats[randomIndex];
      
      if (type === 'feed') {
        cat.state = 'eating';
        cat.timer = 2000;
        setScore(s => s + 10);
      } else {
        cat.state = 'happy';
        cat.timer = 1500;
        setScore(s => s + 5);
      }
      
      return newCats;
    });
  };

  return (
    <div className="bg-white dark:bg-white/5 rounded-[2.5rem] border border-beige-200 p-8 shadow-xl relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {isSecretUnlocked ? (
            <a 
              href="https://www.youtube.com/watch?v=Sueaqo73Ssw&list=PL5TXH58GrZaP6wEnZO_nCLqoLIuU2XpAt&index=1" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-10 h-10 bg-amber-600 rounded-xl flex items-center justify-center hover:scale-110 transition-transform shadow-lg shadow-amber-600/20 cursor-pointer"
              title="Secret Playlist Unlocked!"
            >
              <Coffee className="w-5 h-5 text-white" />
            </a>
          ) : (
            <div className="w-10 h-10 bg-beige-800 rounded-xl flex items-center justify-center">
              <Coffee className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold font-serif">Kitys Caffe</h3>
            <p className="text-xs text-gray-400">Mala pauza za igru</p>
          </div>
        </div>
        <div className="bg-beige-50 dark:bg-white/10 px-4 py-2 rounded-full">
          <span className="text-sm font-bold text-beige-800">Bodovi: {score}</span>
        </div>
      </div>

      <div className="relative h-[250px] bg-beige-50/50 dark:bg-black/20 rounded-3xl border-2 border-dashed border-beige-200 mb-6 overflow-hidden">
        {cats.map(cat => (
          <motion.div
            key={cat.id}
            animate={{ 
              x: cat.x, 
              y: cat.y,
              scaleX: cat.flip ? -1 : 1
            }}
            transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            className="absolute cursor-pointer"
            style={{ color: cat.color }}
          >
            <div className="relative group/cat">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-black/60 px-2 py-0.5 rounded-full text-[10px] font-bold border border-beige-200 shadow-sm whitespace-nowrap opacity-100 transition-opacity">
                {cat.name}
              </div>
              <Cat className="w-10 h-10" />
              {cat.state === 'eating' && (
                <motion.div 
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: -20 }}
                  className="absolute -top-4 left-2"
                >
                  <Utensils className="w-4 h-4 text-amber-600" />
                </motion.div>
              )}
              {cat.state === 'happy' && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-4 left-2"
                >
                  <Heart className="w-4 h-4 text-red-500 fill-current" />
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => handleAction('feed')}
          className="flex items-center justify-center gap-2 py-4 bg-beige-800 text-white rounded-2xl font-bold hover:bg-beige-900 transition-all shadow-lg shadow-beige-900/20"
        >
          <Utensils className="w-4 h-4" /> Nahrani macu
        </button>
        <button 
          onClick={() => handleAction('pet')}
          className="flex items-center justify-center gap-2 py-4 bg-white text-beige-800 border border-beige-200 rounded-2xl font-bold hover:bg-beige-50 transition-all"
        >
          <Heart className="w-4 h-4" /> Pomazi macu
        </button>
      </div>
    </div>
  );
}

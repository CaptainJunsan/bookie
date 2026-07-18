import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { PendingMilestone } from "../lib/milestones";
import { getMilestoneContent } from "../lib/milestones";
import type { FamilyMember } from "../lib/types";

interface Props {
  milestone: PendingMilestone | null;
  viewerMember: FamilyMember | null | undefined;
  onDismiss: () => void;
}

// 5 distinct entrance animation variants, chosen randomly per milestone
const ANIMATION_VARIANTS = [
  "bounce",
  "spin",
  "slide",
  "pop",
  "cascade",
] as const;
type AnimVariant = (typeof ANIMATION_VARIANTS)[number];

function randomVariant(): AnimVariant {
  return ANIMATION_VARIANTS[Math.floor(Math.random() * ANIMATION_VARIANTS.length)];
}

const MODAL_VARIANTS: Record<AnimVariant, { initial: object; animate: object; exit: object; transition: object }> = {
  bounce: {
    initial: { scale: 0.3, opacity: 0, y: 80 },
    animate: { scale: 1, opacity: 1, y: 0 },
    exit: { scale: 0.85, opacity: 0, y: 40 },
    transition: { type: "spring", stiffness: 440, damping: 22 },
  },
  spin: {
    initial: { scale: 0.5, opacity: 0, rotate: -15 },
    animate: { scale: 1, opacity: 1, rotate: 0 },
    exit: { scale: 0.8, opacity: 0, rotate: 8 },
    transition: { type: "spring", stiffness: 380, damping: 24 },
  },
  slide: {
    initial: { y: "100%", opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: "100%", opacity: 0 },
    transition: { type: "spring", stiffness: 340, damping: 32 },
  },
  pop: {
    initial: { scale: 1.4, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.7, opacity: 0 },
    transition: { type: "spring", stiffness: 480, damping: 28 },
  },
  cascade: {
    initial: { scale: 0.6, opacity: 0, y: -60 },
    animate: { scale: 1, opacity: 1, y: 0 },
    exit: { scale: 0.9, opacity: 0, y: 20 },
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
};

// Floating emoji particles for the confetti effect
const CONFETTI_EMOJIS = ["⭐", "✨", "🎉", "🎊", "💫", "🌟", "🎈", "🥳"];

interface Particle {
  id: number;
  emoji: string;
  x: number;
  delay: number;
  duration: number;
  size: number;
  rotation: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length],
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.4 + Math.random() * 1.2,
    size: 18 + Math.floor(Math.random() * 16),
    rotation: -30 + Math.floor(Math.random() * 60),
  }));
}

export default function MilestoneModal({ milestone, viewerMember, onDismiss }: Props) {
  const variantRef = useRef<AnimVariant>(randomVariant());
  const particlesRef = useRef<Particle[]>(generateParticles(18));
  const [open, setOpen] = useState(false);

  // Pick a new animation each time a milestone is set
  useEffect(() => {
    if (milestone) {
      variantRef.current = randomVariant();
      particlesRef.current = generateParticles(18);
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [milestone]);

  function handleClose() {
    setOpen(false);
    setTimeout(onDismiss, 300);
  }

  if (!milestone) return null;

  const content = getMilestoneContent(milestone, viewerMember);
  const variant = MODAL_VARIANTS[variantRef.current];
  const memberColor = content.color;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Falling particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <AnimatePresence>
                {open && particlesRef.current.map((p) => (
                  <motion.span
                    key={p.id}
                    className="absolute select-none"
                    style={{
                      left: `${p.x}%`,
                      top: "-2rem",
                      fontSize: p.size,
                      rotate: p.rotation,
                    }}
                    initial={{ y: 0, opacity: 1 }}
                    animate={{ y: "110vh", opacity: 0 }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      ease: "easeIn",
                    }}
                  >
                    {p.emoji}
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>

            {/* Modal card */}
            <Dialog.Content asChild>
              <motion.div
                className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
                style={{ background: "#FEFAF4" }}
                {...variant}
              >
                {/* Color top strip */}
                <div
                  className="h-2 w-full"
                  style={{ background: `linear-gradient(90deg, ${memberColor}, ${memberColor}99)` }}
                />

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors"
                >
                  <X size={14} className="text-foreground/70" />
                </button>

                {/* Glow circle behind emoji */}
                <div className="flex flex-col items-center px-6 pt-8 pb-2">
                  <motion.div
                    className="relative flex items-center justify-center w-24 h-24 rounded-full mb-4"
                    style={{ background: `${memberColor}18`, border: `3px solid ${memberColor}30` }}
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {/* Subtle pulse ring */}
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${memberColor}50` }}
                      animate={{ scale: [1, 1.25], opacity: [0.6, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                    />
                    <span className="text-5xl leading-none select-none">{content.emoji}</span>
                  </motion.div>

                  {/* Member avatar chip */}
                  <div
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
                    style={{ background: `${memberColor}18`, color: memberColor }}
                  >
                    <span>{milestone.member.avatar_emoji}</span>
                    <span>{milestone.member.nickname}</span>
                  </div>

                  {/* Title */}
                  <h2 className="font-display font-bold text-2xl text-center leading-tight mb-3 text-foreground">
                    {content.title}
                  </h2>

                  {/* Body */}
                  <p className="text-sm text-center text-muted-foreground leading-relaxed mb-6 px-2">
                    {content.body}
                  </p>

                  {/* Milestone badge */}
                  <div
                    className="flex items-center gap-2 rounded-2xl px-4 py-2 mb-6 text-sm font-bold"
                    style={{ background: `${memberColor}15`, color: memberColor }}
                  >
                    <span>{milestone.type === "books" ? "📚" : "📄"}</span>
                    <span>
                      {milestone.type === "books"
                        ? `${milestone.value} books read`
                        : `${milestone.value.toLocaleString()} pages read`}
                    </span>
                  </div>

                  {/* CTA button */}
                  <button
                    onClick={handleClose}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white mb-6 transition-opacity hover:opacity-90 active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg, ${memberColor}, ${memberColor}cc)` }}
                  >
                    Woohoo! 🎉
                  </button>
                </div>
              </motion.div>
            </Dialog.Content>
          </motion.div>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

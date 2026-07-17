import { useState } from "react";

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😄 Faces": ["😀","😃","😄","😁","😆","🤣","😂","🙂","😊","😇","🥰","😍","🤩","😎","🤓","🧐","😏","😌","😔","😢","😭","😤","🥳","😜","🤪","😝","🤑","🤗","😴","😷","🤒","🥴","😵"],
  "🧙 Characters": ["👸","🤴","🧙","🧚","🧛","🧜","🧝","🦸","🦹","🥷","🧑‍🚀","🧑‍🎤","🧑‍🎨","🧑‍🍳","🧑‍🏫","🧑‍🔬","🧑‍💻","🧑‍🚒","👮","🕵️"],
  "🐱 Animals": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙊","🐧","🦅","🦉","🦇","🐴","🦄","🐝","🦋","🐢","🦕","🦖","🐙","🦈","🦭","🐬","🦦","🦥","🦔","🐺"],
  "✨ Magical": ["🌟","⭐","🌈","🌙","☀️","🌊","🔮","🪄","🎩","🎭","🎪","🎡","🏰","🦋","🌺","🌸","🍄","🌙","💫","⚡","🌪️","❄️","🔥","💎","🪩"],
  "📚 Books & Learning": ["📚","📖","✏️","🖊️","📝","📎","📏","📐","🔭","🔬","🎒","💡","🖍️","📓","📔","📒","📕","📗","📘","📙","🏆","🥇","🎖️","🌟","🧩","🎯"],
  "🍕 Food": ["🍎","🍊","🍋","🍇","🍓","🫐","🍒","🍑","🥭","🍍","🥝","🍅","🥑","🌽","🥕","🍕","🍔","🌮","🍜","🍣","🍦","🎂","🍰","🧁","🍩","🍪","🍫","🍬","🍭","🧇","🥞","🧈"],
  "⚽ Sports": ["⚽","🏀","🏈","⚾","🎾","🏐","🎱","🏓","🏸","🥊","🥋","🎯","🏊","🚴","🧗","🤸","⛷️","🏋️","🧘","🏄","🤽","🤺","🏇","🏌️","🤼"],
  "🚀 Adventure": ["🚀","✈️","🚢","🏕️","⛺","🗺️","🌍","🌋","🏔️","🏝️","🗼","🏰","🌉","🎠","🎡","🎢","🎪","🛸","🪂","🤿","🎿"],
};

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export default function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(Object.keys(EMOJI_CATEGORIES)[0]);

  const filtered = search
    ? Object.values(EMOJI_CATEGORIES).flat().filter((e) => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory] || [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-4xl border-2 border-border">
          {value}
        </span>
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search emoji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-input-background border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {!search && (
        <div className="flex gap-1.5 flex-wrap">
          {Object.keys(EMOJI_CATEGORIES).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {cat.split(" ")[0]}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1">
        {filtered.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onChange(emoji)}
            className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all hover:scale-110 hover:bg-secondary ${
              value === emoji ? "bg-primary/20 ring-2 ring-primary" : ""
            }`}
          >
            {emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-8 text-center text-muted-foreground text-sm py-4">No emoji found</p>
        )}
      </div>
    </div>
  );
}

```markdown
# ♟️ GrandMaster Hub — Professional Chess Platform

**Created by:** Damirkyzy Sulamith

![Chess Platform](https://img.shields.io/badge/Chess-Platform-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-green)

## 🎯 Overview

GrandMaster Hub is a **full-featured chess platform** that goes beyond being just another chess game. It's a complete ecosystem for chess enthusiasts, offering AI gameplay, multiplayer matches, tournaments, live broadcasts, and social features — all with a modern, responsive design.

## ✨ Features

### 🎮 Game Modes

| Mode | Description |
|------|-------------|
| **VS AI** | Play against Stockfish with adjustable difficulty (1-20 levels) |
| **Local (Hot-Seat)** | Two players on one device, perfect for playing with friends |
| **Multiplayer** | Play with friends via shareable room links |
| **Lobby** | Browse and join open games created by other players |
| **Tournaments** | Create and participate in round-robin tournaments |

### 🧠 AI Coach

Powered by **DeepSeek API**, the AI Coach analyzes your completed games and provides:
- Identification of critical mistakes
- Best move suggestions with explanations
- Friendly, educational feedback in Russian

### 📺 Live Broadcasts

- Watch ongoing games in real-time (updates every 2 seconds)
- Live chat for viewers
- Automatic game list with player names and ratings

### 🏆 Tournaments

- Create tournaments with custom names and player limits (4-8 players)
- Round-robin pairing system
- Automatic game room creation for each match
- Player points tracking

### 👤 User Features

- **Authentication** via email/password (Supabase Auth)
- **ELO Rating System** (starting from 1200)
- **Chess Titles** based on ELO:
  - 2000+ → Candidate Master (КМС)
  - 2200+ → National Master (NM)
  - 2300+ → FIDE Master (FM)
  - 2400+ → International Master (IM)
  - 2500+ → Grandmaster (GM)
- **Profile avatars** (upload to Supabase Storage)
- **Auto-location detection** (city/country via IP)
- **Game history** with full PGN export
- **Leaderboard** grouped by country

### 💬 Real-time Features

- **In-game chat** during multiplayer matches
- **Draw offers** with accept/decline modal
- **Voice move input** (Web Speech API - Russian language)
- **Dark/Light theme** toggle (persisted in localStorage)

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui |
| **Chess Engine** | chess.js, react-chessboard, Stockfish.js |
| **Database** | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| **AI Analysis** | DeepSeek API |
| **Voice Recognition** | Web Speech API |
| **Deployment** | Vercel |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase account (free tier)
- DeepSeek API key (optional, demo fallback available)

### Installation

```bash
# Clone the repository
git clone https://github.com/gafuradm/che.git
cd che

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
```

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
DEEPSEEK_API_KEY=your_deepseek_api_key
```

### Database Setup

Run the following SQL commands in your Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT,
  city TEXT,
  country TEXT,
  elo INT DEFAULT 1200,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create games table
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  pgn TEXT,
  result TEXT,
  played_at TIMESTAMPTZ DEFAULT now()
);

-- Create game_rooms table for multiplayer
CREATE TABLE game_rooms (
  id TEXT PRIMARY KEY,
  player1_id UUID REFERENCES auth.users(id),
  player2_id UUID REFERENCES auth.users(id) DEFAULT NULL,
  fen TEXT DEFAULT 'start',
  current_turn TEXT DEFAULT 'w',
  status TEXT DEFAULT 'waiting',
  time_control TEXT DEFAULT 'rapid',
  time_left_player1 INT DEFAULT 600,
  time_left_player2 INT DEFAULT 600,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Realtime for game_rooms
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
```

### Storage Setup

Create a public bucket named `avatars` in Supabase Storage.

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
grandmaster-hub/
├── app/
│   ├── game/
│   │   ├── ai/              # VS AI mode
│   │   ├── local/           # Hot-seat mode
│   │   └── multiplayer/     # Online multiplayer
│   ├── lobby/               # Open games list
│   ├── watch/               # Live broadcasts
│   ├── tournament/          # Tournament management
│   ├── profile/             # User profile
│   ├── history/             # Game history
│   ├── leaderboard/         # ELO leaderboard
│   └── api/                 # API routes
├── components/              # Reusable components
│   ├── Chessboard.tsx       # Interactive chessboard
│   ├── VoiceMove.tsx        # Voice recognition
│   ├── ThemeToggle.tsx      # Dark/light mode
│   └── Auth.tsx             # Authentication
├── lib/                     # Utilities
│   ├── supabase.ts          # Supabase client
│   ├── stockfish.ts         # Stockfish integration
│   ├── elo.ts               # ELO calculation
│   └── db.ts                # Database helpers
└── public/
    └── stockfish.js         # Stockfish engine
```

## 🎮 Game Modes in Detail

### VS AI
- White plays as user, Black as Stockfish
- Adjustable difficulty (1-20) affects Stockfish's Skill Level
- Game history saved to Supabase
- AI Coach available after game

### Multiplayer
- Create room → share link → opponent joins
- Real-time move synchronization via Supabase Realtime
- In-game chat and draw offers
- ELO ratings update after game completion

### Tournaments
- Creator sets name, time control, and player limit
- Players join via tournament page
- Start tournament when ready → automatic round-robin pairing
- Each match creates a separate game room

## 🏆 ELO System

The platform uses a standard ELO calculation formula:

```
Expected Score = 1 / (1 + 10^((opponent_rating - player_rating)/400))
New Rating = Old Rating + K * (Actual Score - Expected Score)
```

- **K-factor:** 32 (standard for new/amateur players)
- **Starting ELO:** 1200
- ELO changes only in multiplayer matches

## 🤝 Contribution

This project was created as a submission for the NFactorial School hackathon. The goal was to demonstrate not just coding ability, but product thinking — including monetization potential, user retention mechanics, and a unique market niche.

## 📄 License

MIT

## 👩‍💻 Author

**Damirkyzy Sulamith**

---

## 🎯 Unique Value Proposition

Unlike traditional chess platforms, GrandMaster Hub offers:

1. **AI Coach with Business Analogies** – Not just "you made a mistake", but strategic thinking development
2. **Internal Tournament Currency** – Engagement and retention mechanics
3. **Live Broadcast System** – Watch games in real-time with chat
4. **Voice Moves** – Accessibility and fun factor
5. **Auto-location & Leaderboards** – Social competition by country

## 🔗 Links

- [Live Demo](https://chess-grandmaster.vercel.app)
- [GitHub Repository](https://github.com/gafuradm/che)

---

*Built with ❤️ using Next.js, Supabase, and Stockfish*
```
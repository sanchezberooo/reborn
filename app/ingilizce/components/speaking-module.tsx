'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SPEAKING_DATA = {
  A1: [
    "Tell me about yourself. What's your name and where are you from?",
    "What do you do every day? Describe your daily routine.",
    "Describe your family. How many people are in your family?",
    "What is your favourite food? Why do you like it?",
    "What colours do you like? Describe something in your room.",
    "What animals do you like? Do you have any pets?",
    "What do you do in your free time?",
    "What is the weather like today in your city?",
    "Describe your bedroom. What is in it?",
    "What do you usually eat for breakfast?",
    "How do you go to school or work?",
    "What time do you wake up and go to bed? Tell me about your day.",
  ],
  A2: [
    "Describe a typical weekend. What do you usually do?",
    "Talk about your hometown. What do you like about it?",
    "Compare two types of transport. Which do you prefer and why?",
    "Talk about a trip or holiday you took. Where did you go?",
    "What job would you like to have in the future? Why?",
    "Describe someone you admire. Why do you admire them?",
    "What do you think about social media? Is it good or bad?",
    "Talk about a film or TV series you watched recently.",
    "Describe your best friend. What do you like about them?",
    "What are your plans for this weekend? What are you going to do?",
    "Compare two cities or countries. Which would you prefer to live in?",
    "Describe a time when something funny or unusual happened to you.",
  ],
  B1: [
    "Do you think technology makes our lives better or worse? Give reasons.",
    "Talk about an important decision you made. What happened?",
    "What are the advantages and disadvantages of living in a big city?",
    "Should students learn a foreign language at school? Why/Why not?",
    "How has your hometown changed in recent years?",
    "Talk about an achievement you are proud of.",
    "What would you do if you could live in another country?",
    "Do you think people today have a good work-life balance?",
    "Discuss the advantages and disadvantages of social media for young people.",
    "Do you think climate change is the most serious problem facing the world today?",
    "Talk about a book, film, or piece of music that influenced you. Why did it have an impact?",
    "If you could change one thing about your education system, what would it be and why?",
  ],
}

const LEVEL_COLORS: Record<string, string> = {
  A1: '#22c55e',
  A2: '#3b82f6',
  B1: '#c8a96e',
}

type Level = 'A1' | 'A2' | 'B1'

function QuestionCard({ question, level, onAskSanchez }: {
  question: string
  level: string
  onAskSanchez: (q: string) => void
}) {
  const color = LEVEL_COLORS[level] ?? '#a0a0a0'
  return (
    <div
      style={{
        background: '#111111',
        border: '1px solid #222222',
        borderRadius: 12,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
      }}
    >
      <span style={{ fontSize: 16, marginTop: 1, flexShrink: 0 }}>🎤</span>
      <div style={{ flex: 1 }}>
        <p style={{ color: '#ffffff', fontSize: 13, lineHeight: 1.6, marginBottom: 10 }}>{question}</p>
        <button
          onClick={() => onAskSanchez(question)}
          style={{
            padding: '5px 12px',
            background: color + '15',
            border: `1px solid ${color}40`,
            borderRadius: 6,
            color,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Bu soruyu Sanchez'e sor
        </button>
      </div>
    </div>
  )
}

export function SpeakingModule() {
  const router = useRouter()
  const [activeLevel, setActiveLevel] = useState<Level>('A1')

  function handleAskSanchez(question: string) {
    const prompt = encodeURIComponent(
      `İngilizce konuşma pratiği yapmak istiyorum. Bana bu soruyu sor ve cevabımı düzelt:\n\n"${question}"\n\nBen cevap verdikten sonra gramerimi ve ifadelerimi düzelt.`
    )
    sessionStorage.setItem('reborn:mini-prompt', decodeURIComponent(prompt))
    router.push('/')
  }

  const levels: Level[] = ['A1', 'A2', 'B1']
  const questions: string[] = SPEAKING_DATA[activeLevel]

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ color: '#ffffff', fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Konuşma</h2>
        <p style={{ color: '#a0a0a0', fontSize: 13 }}>
          Soruları oku, cevabını düşün, ardından Sanchez ile pratik yap.
        </p>
      </div>

      {/* Info banner */}
      <div
        style={{
          background: 'rgba(200,169,110,0.06)',
          border: '1px solid rgba(200,169,110,0.2)',
          borderRadius: 12,
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
        <p style={{ color: '#a0a0a0', fontSize: 12, lineHeight: 1.6 }}>
          Her kartın altındaki <strong style={{ color: '#c8a96e' }}>Sanchez'e sor</strong> butonuna tıkla.
          Sanchez sana o soruyu sorar, cevabını İngilizce yaz, o da gramerini düzeltir.
        </p>
      </div>

      {/* Level tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {levels.map((lv) => {
          const isActive = activeLevel === lv
          const color = LEVEL_COLORS[lv]
          return (
            <button
              key={lv}
              onClick={() => setActiveLevel(lv)}
              style={{
                padding: '6px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${isActive ? color : '#222222'}`,
                background: isActive ? color + '20' : 'transparent',
                color: isActive ? color : '#a0a0a0',
                transition: 'all 0.15s',
              }}
            >
              {lv}
            </button>
          )
        })}
        {/* B2 locked */}
        <button
          disabled
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'default',
            border: '1px solid #222222',
            background: 'transparent',
            color: '#333',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          B2 <span style={{ fontSize: 9 }}>Haziran</span>
        </button>

        {/* Question count */}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#555', alignSelf: 'center' }}>
          {questions.length} soru
        </span>
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.map((q: string, i: number) => (
          <QuestionCard
            key={i}
            question={q}
            level={activeLevel}
            onAskSanchez={handleAskSanchez}
          />
        ))}
      </div>
    </div>
  )
}

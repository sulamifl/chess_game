import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { pgn } = await request.json();
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  if (!deepseekKey) {
    return NextResponse.json({ error: 'DeepSeek API key missing' }, { status: 500 });
  }

  const prompt = `Ты шахматный тренер. Вот полная партия в формате PGN:
${pgn}

Проанализируй партию и найди 2-3 самые грубые ошибки (для того, кто играл белыми). Для каждой ошибки укажи:
- Номер хода
- Какой ход был сделан
- Какой ход был лучшим (и почему)
- Дай короткий, понятный совет.

Ответ напиши в виде маркированного списка на русском языке, без лишних технических деталей.`;

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${deepseekKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: 'Ты дружелюбный шахматный коуч, который объясняет понятно и с юмором.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  const advice = data.choices?.[0]?.message?.content || 'Не удалось проанализировать партию.';
  return NextResponse.json({ advice });
}
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pgn } = await request.json();
    const deepseekKey = process.env.DEEPSEEK_API_KEY;

    console.log('PGN получен, длина:', pgn?.length);
    console.log('DeepSeek ключ присутствует:', !!deepseekKey);

    if (!deepseekKey) {
      return NextResponse.json({ advice: 'Ключ API DeepSeek не настроен. Добавьте DEEPSEEK_API_KEY в .env.local' }, { status: 500 });
    }

    if (!pgn || pgn.trim() === '') {
      return NextResponse.json({ advice: 'Нет данных партии для анализа.' }, { status: 400 });
    }

    const prompt = `Ты шахматный тренер. Проанализируй эту партию (PGN) и найди 2-3 самые грубые ошибки (для того, кто играл белыми). Для каждой ошибки укажи: номер хода, какой ход был сделан, какой ход был лучшим и почему. Дай короткие, понятные советы. Ответ напиши в виде маркированного списка на русском языке.

PGN:
${pgn}`;

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'Ты дружелюбный шахматный коуч, объясняешь понятно.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    console.log('DeepSeek ответ статус:', response.status);

    if (!response.ok) {
      console.error('DeepSeek ошибка:', data);
      return NextResponse.json({ advice: `Ошибка API: ${data.error?.message || 'неизвестная'}` }, { status: response.status });
    }

    const advice = data.choices?.[0]?.message?.content || 'Не удалось проанализировать партию.';
    return NextResponse.json({ advice });
  } catch (error) {
    console.error('Coach error:', error);
    return NextResponse.json({ advice: 'Ошибка сервера при анализе' }, { status: 500 });
  }
}
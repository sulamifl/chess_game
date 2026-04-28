interface LocationInfo {
    city: string;
    country: string;
  }
  
  export async function getUserLocation(): Promise<LocationInfo | null> {
    // Пробуем несколько бесплатных API
    const providers = [
      'https://ipapi.co/json/',
      'https://freeipapi.com/api/json/',
      'https://api.ipify.org?format=json' // только IP, но потом можно использовать другой сервис
    ];
  
    for (const url of providers) {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) continue;
        const data = await response.json();
        
        // Для ipapi.co
        if (data.city && data.country_name) {
          return {
            city: data.city || 'Неизвестный город',
            country: data.country_name || 'Неизвестная страна',
          };
        }
        // Для freeipapi.com
        if (data.city && data.countryName) {
          return {
            city: data.city,
            country: data.countryName,
          };
        }
        // Если получили только IP, можно сделать дополнительный запрос (но для простоты пропустим)
      } catch (error) {
        console.error(`Ошибка при запросе к ${url}:`, error);
        continue;
      }
    }
  
    // Если ничего не сработало, возвращаем null (используем значения по умолчанию)
    console.warn('Не удалось определить местоположение');
    return null;
  }
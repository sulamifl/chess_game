interface LocationInfo {
    city: string;
    country: string;
  }
  
  export async function getUserLocation() {
    try {
      const res = await fetch('/api/location');
      const data = await res.json();
      return { city: data.city, country: data.country };
    } catch {
      return null;
    }
  }
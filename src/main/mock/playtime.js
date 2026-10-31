export function getSummary() {
  const dailyMinutes = [
    { day: 'saturday', minutes: 52 }, { day: 'sunday', minutes: 95 }, { day: 'monday', minutes: 40 },
    { day: 'tuesday', minutes: 0 }, { day: 'wednesday', minutes: 123 }, { day: 'thursday', minutes: 76 }, { day: 'friday', minutes: 144 }
  ];
  return {
    last7DaysMinutes: dailyMinutes.reduce((sum, item) => sum + item.minutes, 0),
    previous7DaysMinutes: 455,
    changePercent: 16,
    dailyMinutes,
    averageSessionMinutes: 61,
    longestSessionMinutes: 144,
    daysPlayed: 6
  };
}

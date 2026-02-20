export interface ForecastOutlier {
  asin: string
  forecastWeek: string
  status: 'new' | 'acknowledged' | 'acted_on' | 'dismissed'
}

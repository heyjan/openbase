import type { PdfDashboardSpec } from './pdf-export'

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const regions = ['North', 'West', 'South', 'Central', 'Online', 'Partner']
const channels = ['Enterprise', 'Mid Market', 'SMB', 'Self Serve', 'Partner']

export const createPdfTestDashboardSpec = (): PdfDashboardSpec => {
  const monthlyRows = months.map((month, index) => ({
    month,
    revenue: 420 + index * 34 + Math.round(Math.sin(index / 1.5) * 38),
    margin: 128 + index * 13 + Math.round(Math.cos(index / 1.8) * 18),
    forecast: 445 + index * 37
  }))

  const regionRows = regions.map((region, index) => ({
    region,
    pipeline: [620, 540, 455, 388, 330, 276][index],
    closed: [382, 342, 308, 244, 196, 168][index]
  }))

  const mixRows = channels.map((channel, index) => ({
    channel,
    share: [31, 24, 19, 15, 11][index]
  }))

  const riskRows = [
    { account: 'Aster Labs', segment: 'Enterprise', arr: 184000, health: 91, owner: 'Mina' },
    { account: 'Northwind', segment: 'Mid Market', arr: 136000, health: 76, owner: 'Jonas' },
    { account: 'Helio Foods', segment: 'Enterprise', arr: 126500, health: 72, owner: 'Ava' },
    { account: 'Blue Finch', segment: 'SMB', arr: 84000, health: 88, owner: 'Noor' },
    { account: 'Quantive', segment: 'Enterprise', arr: 221000, health: 64, owner: 'Mina' },
    { account: 'Verdant', segment: 'Mid Market', arr: 93000, health: 81, owner: 'Jonas' },
    { account: 'Kairo', segment: 'Partner', arr: 58000, health: 69, owner: 'Ava' },
    { account: 'Orbitware', segment: 'SMB', arr: 76000, health: 84, owner: 'Noor' }
  ]

  const weeklyRows = Array.from({ length: 24 }, (_, index) => ({
    week: `W${String(index + 1).padStart(2, '0')}`,
    activeUsers: 7800 + index * 180 + Math.round(Math.sin(index / 2) * 420),
    retainedUsers: 5200 + index * 150 + Math.round(Math.cos(index / 3) * 260)
  }))

  return {
    title: 'Revenue Operations Control Tower',
    subtitle: 'Synthetic dataset for validating adaptive PDF export with dense charts and tables.',
    generatedAt: '2026-05-18T01:00:00.000Z',
    modules: [
      {
        id: 'summary-note',
        type: 'text',
        title: 'Executive Summary',
        text:
          'Revenue is pacing ahead of forecast, with enterprise expansion carrying most of the upside. The layout intentionally mixes KPI cards, wide time-series charts, categorical bars, a donut chart, and a dense table to exercise adaptive PDF sizing.',
        priority: 100
      },
      {
        id: 'revenue-kpi',
        type: 'kpi',
        title: 'Booked Revenue',
        label: 'Booked Revenue',
        value: 6840000,
        prefix: '$',
        width: 'third',
        priority: 90
      },
      {
        id: 'margin-kpi',
        type: 'kpi',
        title: 'Gross Margin',
        label: 'Gross Margin',
        value: 71.4,
        suffix: '%',
        width: 'third',
        priority: 90
      },
      {
        id: 'retention-kpi',
        type: 'kpi',
        title: 'Net Retention',
        label: 'Net Retention',
        value: 119.8,
        suffix: '%',
        width: 'third',
        priority: 90
      },
      {
        id: 'monthly-revenue',
        type: 'line',
        title: 'Monthly Revenue vs Forecast',
        note: 'Line chart should remain legible with three series.',
        data: monthlyRows,
        xField: 'month',
        yFields: [
          { field: 'revenue', label: 'Revenue', color: '#175cd3' },
          { field: 'forecast', label: 'Forecast', color: '#f79009' },
          { field: 'margin', label: 'Margin', color: '#12b76a' }
        ],
        width: 'full',
        priority: 80
      },
      {
        id: 'regional-pipeline',
        type: 'horizontal_bar',
        title: 'Regional Pipeline',
        note: 'Horizontal labels need extra height.',
        data: regionRows,
        xField: 'region',
        yFields: [
          { field: 'pipeline', label: 'Pipeline', color: '#175cd3' },
          { field: 'closed', label: 'Closed Won', color: '#12b76a' }
        ],
        priority: 70
      },
      {
        id: 'channel-mix',
        type: 'pie',
        title: 'Channel Mix',
        data: mixRows,
        categoryField: 'channel',
        valueField: 'share',
        priority: 60
      },
      {
        id: 'weekly-usage',
        type: 'bar',
        title: 'Weekly Product Usage',
        note: 'Long category list forces a full-width chart.',
        data: weeklyRows,
        xField: 'week',
        yFields: [
          { field: 'activeUsers', label: 'Active Users', color: '#175cd3' },
          { field: 'retainedUsers', label: 'Retained Users', color: '#7c3aed' }
        ],
        priority: 50
      },
      {
        id: 'account-table',
        type: 'table',
        title: 'Accounts Requiring Attention',
        data: riskRows,
        columns: ['account', 'segment', 'arr', 'health', 'owner'],
        priority: 40
      }
    ]
  }
}

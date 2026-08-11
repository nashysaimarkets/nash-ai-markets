export const BLS_API_FIXTURE = {
  status: "REQUEST_SUCCEEDED",
  responseTime: 10,
  message: [],
  Results: {
    series: [
      { seriesID: "CUSR0000SA0", data: [{ year: "2026", period: "M07", periodName: "July", value: "323.048", footnotes: [{}] }] },
      { seriesID: "CUSR0000SA0L1E", data: [{ year: "2026", period: "M07", periodName: "July", value: "331.207", footnotes: [{}] }] },
      { seriesID: "CES0000000001", data: [{ year: "2026", period: "M07", periodName: "July", value: "159539", footnotes: [{}] }] },
      { seriesID: "LNS14000000", data: [{ year: "2026", period: "M07", periodName: "July", value: "4.2", footnotes: [{}] }] },
      { seriesID: "WPSFD4", data: [{ year: "2026", period: "M06", periodName: "June", value: "149.7", footnotes: [{}] }] },
      { seriesID: "JTS000000000000000JOL", data: [{ year: "2026", period: "M06", periodName: "June", value: "7437", footnotes: [{}] }] },
    ],
  },
};

export const BLS_CALENDAR_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:cpi-july-2026
DTSTART;TZID=America/New_York:20260812T083000
SUMMARY:Consumer Price Index for July 2026
END:VEVENT
BEGIN:VEVENT
UID:ppi-july-2026
DTSTART;TZID=America/New_York:20260813T083000
SUMMARY:Producer Price Index for July 2026
END:VEVENT
BEGIN:VEVENT
UID:employment-august-2026
DTSTART;TZID=America/New_York:20260904T083000
SUMMARY:Employment Situation for August 2026
END:VEVENT
BEGIN:VEVENT
UID:jolts-july-2026
DTSTART;TZID=America/New_York:20260901T100000
SUMMARY:Job Openings and Labor Turnover Survey for July 2026
END:VEVENT
BEGIN:VEVENT
UID:irrelevant-release
DTSTART;TZID=America/New_York:20260818T083000
SUMMARY:U.S. Import and Export Price Indexes for July 2026
END:VEVENT
END:VCALENDAR`;

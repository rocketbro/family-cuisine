// Today's date, and the hour, for a screen. Each is checked on any change in the app, which includes the phone
// waking up, so a screen left open overnight moves on to the new day.
import { useEffect, useState } from 'react';
import { toISODate, type ISODate } from '../../domain/dates.ts';
import { onChange } from '../data-events.ts';

export function useToday(): ISODate {
  const [today, setToday] = useState(() => toISODate(new Date()));
  useEffect(() => onChange(() => setToday(toISODate(new Date()))), []);
  return today;
}

export function useMinutes(): number {
  const now = () => { const date = new Date(); return date.getHours() * 60 + date.getMinutes(); };
  const [minutes, setMinutes] = useState(now);
  useEffect(() => onChange(() => setMinutes(now())), []);
  return minutes;
}

export function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => onChange(() => setHour(new Date().getHours())), []);
  return hour;
}
